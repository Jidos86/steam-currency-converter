const CACHE_MS = 6 * 60 * 60 * 1000; // 6 hours

export function safeParseJSON<T = unknown>(value: string | null): T | null {
	if (!value) return null;
	try {
		return JSON.parse(value) as T;
	} catch {
		return null;
	}
}

interface RatesDoc {
	date?: string;
	[base: string]: Record<string, number> | string | undefined;
}

function cacheKey(base: string): string {
	return `scc_rates_${base}`;
}
function cacheTimeoutKey(base: string): string {
	return `scc_rates_timeout_${base}`;
}

function readRate(doc: RatesDoc | null, base: string, quote: string): number | undefined {
	const rates = doc?.[base];
	const value = typeof rates === 'object' ? rates?.[quote] : undefined;
	return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}

function cacheRates(key: string, data: RatesDoc): void {
	try {
		localStorage.setItem(cacheKey(key), JSON.stringify(data));
		localStorage.setItem(cacheTimeoutKey(key), String(Date.now() + CACHE_MS));
	} catch {
		/* localStorage may be unavailable */
	}
}

async function fetchFreedomBankRate(base: string, quote: string): Promise<number> {
	const response = await fetch('https://bankffin.kz/api/exchange-rates/getRates', {
		cache: 'no-store',
		credentials: 'omit',
	});
	if (!response.ok) throw new Error(`Freedom Bank HTTP ${response.status}`);

	const payload = await response.json();
	if (payload?.success !== true || !Array.isArray(payload.data?.non_cash)) {
		throw new Error('Invalid Freedom Bank rates response');
	}

	const baseCode = base.toUpperCase();
	const quoteCode = quote.toUpperCase();
	const pair = payload.data.non_cash.find((entry: Record<string, unknown> | null) => (
		(entry?.buyCode === baseCode && entry.sellCode === quoteCode) ||
		(entry?.buyCode === quoteCode && entry.sellCode === baseCode)
	));
	const buy = typeof pair?.buyRate === 'string' ? Number(pair.buyRate.replace(/\s/g, '')) : NaN;
	const sell = typeof pair?.sellRate === 'string' ? Number(pair.sellRate.replace(/\s/g, '')) : NaN;
	if (!Number.isFinite(buy) || buy <= 0 || !Number.isFinite(sell) || sell <= 0) {
		throw new Error(`No usable Freedom Bank rate for ${baseCode}/${quoteCode}`);
	}
	const midpoint = buy / 2 + sell / 2;
	return pair.buyCode === baseCode ? midpoint : 1 / midpoint;
}

async function fetchRates(b: string, quote: string): Promise<number> {
	const sources = [
		`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${b}.json?${Math.random()}`,
		`https://latest.currency-api.pages.dev/v1/currencies/${b}.json?${Math.random()}`,
		`https://raw.githubusercontent.com/fawazahmed0/exchange-api/main/latest/currencies/${b}.json?${Math.random()}`,
	];

	let lastError: unknown = null;
	for (const url of sources) {
		try {
			const response = await fetch(url, { cache: 'no-store' });
			if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
			const data = (await response.json()) as RatesDoc;
			const value = readRate(data, b, quote);
			if (value === undefined) throw new Error(`Rate missing in ${url}`);
			cacheRates(b, data);
			return value;
		} catch (error) {
			lastError = error;
		}
	}
	throw lastError instanceof Error ? lastError : new Error('Failed to fetch rates');
}

export async function getRate(base: string, source: string, preferFreedomBank: boolean): Promise<number> {
	const b = base.toLowerCase();
	const quote = source.toLowerCase();
	const bankKey = `freedom_${b}_${quote}`;
	let timeout = 0;
	let cache: RatesDoc | null = null;
	let bankTimeout = 0;
	let bankCache: RatesDoc | null = null;
	try {
		timeout = Number(localStorage.getItem(cacheTimeoutKey(b)) || 0);
		cache = safeParseJSON<RatesDoc>(localStorage.getItem(cacheKey(b)));
		bankTimeout = Number(localStorage.getItem(cacheTimeoutKey(bankKey)) || 0);
		bankCache = safeParseJSON<RatesDoc>(localStorage.getItem(cacheKey(bankKey)));
	} catch {
		/* ignore */
	}
	const rateDate = cache && typeof cache.date === 'string' ? Date.parse(cache.date) : 0;

	const now = Date.now();
	const cachedRate = readRate(cache, b, quote);
	const cachedBankRate = readRate(bankCache, b, quote);
	const currencyApi = {
		cached: cachedRate,
		fresh: timeout > now && rateDate + 24 * 60 * 60 * 1000 > now,
		fetch: () => fetchRates(b, quote),
	};
	const freedomBank = {
		cached: cachedBankRate,
		fresh: bankTimeout > now,
		fetch: async () => {
			const value = await fetchFreedomBankRate(b, quote);
			cacheRates(bankKey, { [b]: { [quote]: value } });
			return value;
		},
	};
	const providers = preferFreedomBank ? [freedomBank, currencyApi] : [currencyApi, freedomBank];

	let lastError: unknown;
	for (const provider of providers) {
		if (provider.fresh && provider.cached !== undefined) return provider.cached;
		try {
			return await provider.fetch();
		} catch (error) {
			lastError = error;
		}
	}
	const staleRate = providers[0].cached ?? providers[1].cached;
	if (staleRate !== undefined) {
		return staleRate;
	}
	throw lastError;
}
