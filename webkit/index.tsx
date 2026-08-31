/**
 * Steam Currency Converter — webkit module.
 *
 * Injected by Millennium into Steam page contexts (store / community / overlay)
 * with Page.setBypassCSP, so it works even where the store CSP would block an
 * external <script> (e.g. the Steam China store).
 *
 * Only DOM APIs + textContent are used to render the hint — no innerHTML,
 * no eval, no remote code. Network access is limited to the public
 * exchange-rate JSON endpoints in fetchRates(). The target currency is read
 * from the plugin settings via the lua backend.
 */
import { callable } from '@steambrew/webkit';

const getSettings = callable<[], string>('get_settings');

interface SteamCurrency {
	id: number;
	abbr: string;
	symbol: string;
}

// Full Steam wallet currency table: id -> { abbr, symbol }.
// symbol is only a detection fallback (primary detection is by wallet id).
const STEAM_CURRENCIES: SteamCurrency[] = [
	{ id: 1, abbr: 'USD', symbol: '$' },
	{ id: 2, abbr: 'GBP', symbol: '£' },
	{ id: 3, abbr: 'EUR', symbol: '€' },
	{ id: 4, abbr: 'CHF', symbol: 'CHF' },
	{ id: 5, abbr: 'RUB', symbol: '₽' },
	{ id: 6, abbr: 'PLN', symbol: 'zł' },
	{ id: 7, abbr: 'BRL', symbol: 'R$' },
	{ id: 8, abbr: 'JPY', symbol: '¥' },
	{ id: 9, abbr: 'NOK', symbol: 'kr' },
	{ id: 10, abbr: 'IDR', symbol: 'Rp' },
	{ id: 11, abbr: 'MYR', symbol: 'RM' },
	{ id: 12, abbr: 'PHP', symbol: '₱' },
	{ id: 13, abbr: 'SGD', symbol: 'S$' },
	{ id: 14, abbr: 'THB', symbol: '฿' },
	{ id: 15, abbr: 'VND', symbol: '₫' },
	{ id: 16, abbr: 'KRW', symbol: '₩' },
	{ id: 17, abbr: 'TRY', symbol: 'TL' },
	{ id: 18, abbr: 'UAH', symbol: '₴' },
	{ id: 19, abbr: 'MXN', symbol: 'Mex$' },
	{ id: 20, abbr: 'CAD', symbol: 'CDN$' },
	{ id: 21, abbr: 'AUD', symbol: 'A$' },
	{ id: 22, abbr: 'NZD', symbol: 'NZ$' },
	{ id: 23, abbr: 'CNY', symbol: '¥' },
	{ id: 24, abbr: 'INR', symbol: '₹' },
	{ id: 25, abbr: 'CLP', symbol: 'CLP$' },
	{ id: 26, abbr: 'PEN', symbol: 'S/.' },
	{ id: 27, abbr: 'COP', symbol: 'COL$' },
	{ id: 28, abbr: 'ZAR', symbol: 'R' },
	{ id: 29, abbr: 'HKD', symbol: 'HK$' },
	{ id: 30, abbr: 'TWD', symbol: 'NT$' },
	{ id: 31, abbr: 'SAR', symbol: 'SR' },
	{ id: 32, abbr: 'AED', symbol: 'AED' },
	{ id: 33, abbr: 'SEK', symbol: 'kr' },
	{ id: 34, abbr: 'ARS', symbol: 'ARS$' },
	{ id: 35, abbr: 'ILS', symbol: '₪' },
	{ id: 36, abbr: 'BYN', symbol: 'Br' },
	{ id: 37, abbr: 'KZT', symbol: '₸' },
	{ id: 38, abbr: 'KWD', symbol: 'KD' },
	{ id: 39, abbr: 'QAR', symbol: 'QR' },
	{ id: 40, abbr: 'CRC', symbol: '₡' },
	{ id: 41, abbr: 'UYU', symbol: '$U' },
];

// Distinctive currency signs for the "this text is a price" heuristic.
// Only multi-char / unique signs, to avoid matching ordinary text.
const SIGN_TO_CURRENCY: Record<string, string> = {
	'ARS$': 'ARS',
	'Mex$': 'MXN',
	'CDN$': 'CAD',
	'COL$': 'COP',
	'CLP$': 'CLP',
	'NT$': 'TWD',
	'HK$': 'HKD',
	'NZ$': 'NZD',
	'S$': 'SGD',
	'A$': 'AUD',
	'R$': 'BRL',
	'$U': 'UYU',
	'RM': 'MYR',
	'Rp': 'IDR',
	'CHF': 'CHF',
	'zł': 'PLN',
	'₸': 'KZT',
	'TL': 'TRY',
	'₺': 'TRY',
	'€': 'EUR',
	'£': 'GBP',
	'₴': 'UAH',
	'₹': 'INR',
	'₪': 'ILS',
	'₩': 'KRW',
	'฿': 'THB',
	'₫': 'VND',
	'₱': 'PHP',
	'₡': 'CRC',
	'¥': 'CNY',
	'$': 'USD',
};

const SELECTORS = [
	'#header_wallet_balance',
	'div[class*=StoreSalePriceBox]',
	'.game_purchase_price',
	'.discount_final_price',
	'.discount_final_price > div:not([class])',
	'.search_price',
	'.price',
	'.match_subtitle',
	'.game_area_dlc_price',
	'.savings.bundle_savings',
	'.wallet_column',
	'.wht_total',
	'.normal_price',
	'.sale_price',
	'.StoreSalePriceWidgetContainer:not(.Discounted) div',
	'.StoreSalePriceWidgetContainer.Discounted div:nth-child(2) > div:nth-child(2)',
	'#marketWalletBalanceAmount',
	'.market_commodity_order_summary > span:nth-child(2)',
	'.market_commodity_orders_table tr > td:first-child',
	'.market_listing_price_with_fee',
	'.market_activity_price',
	'.item_market_actions > div > div:nth-child(2)',
	// Cart / checkout
	'.cart_area_summary_final_price',
	'#cart_estimated_total',
	'#cart_total_wrapper',
	'#total_original',
	'#total_after_discounts',
	'#gift_or_wallet_new_total',
	'#accountBalanceAmount',
	'.checkout_content .price',
	'#cart_item_list .price',
	'div[class*=EstimatedTotal]',
	'div[class*=SubtotalRow] > div:last-child',
	'div[class*=CheckoutSummary] div[class*=Price]',
]
	.map((x) => `${x}:not([data-scc-done="1"])`)
	.join(', ');

const EXTRA_SCAN_PATHS = ['/cart', '/checkout'];

const CACHE_MS = 6 * 60 * 60 * 1000; // 6 hours

let sourceCurrency: string | null = null;
let sourceCurrencySign: string | null = null;
let targetCurrency = 'RUB';
let rate: number | null = null; // 1 source unit = `rate` target units
let observerStarted = false;
let injectScheduled = false;

function log(...args: unknown[]): void {
	console.log('[Steam Currency Converter]', ...args);
}

function findCurrencyById(id: number): SteamCurrency | null {
	return STEAM_CURRENCIES.find((c) => c.id === id) ?? null;
}

function makeSpan(className: string, text: string): HTMLSpanElement {
	const span = document.createElement('span');
	span.className = className;
	span.textContent = text;
	return span;
}

function addStyles(): void {
	if (document.getElementById('scc-style')) return;
	const style = document.createElement('style');
	style.id = 'scc-style';
	style.textContent = `
		.scc-original { font-size: 11px; }
		.scc-block { padding-left: 5px; white-space: nowrap; opacity: 0.92; }
		.scc-inline { white-space: nowrap; opacity: 0.92; }
		.tab_item_discount { width: 160px !important; }
		.tab_item_discount .discount_prices { width: 100% !important; }
		.tab_item_discount .discount_final_price { padding: 0 !important; }
		.home_marketing_message.small .discount_block { height: auto !important; }
		.discount_block_inline { white-space: nowrap !important; }
		.curator #RecommendationsRows .store_capsule.price_inline .discount_block { min-width: 200px !important; }
		.market_listing_their_price { min-width: 130px !important; }
	`;
	document.head.appendChild(style);
}

function safeParseJSON<T = unknown>(value: string | null): T | null {
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

async function fetchRates(base: string): Promise<RatesDoc> {
	const b = base.toLowerCase();
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
			try {
				localStorage.setItem(cacheKey(b), JSON.stringify(data));
				localStorage.setItem(cacheTimeoutKey(b), String(Date.now() + CACHE_MS));
			} catch {
				/* localStorage may be unavailable */
			}
			return data;
		} catch (error) {
			lastError = error;
		}
	}
	throw lastError instanceof Error ? lastError : new Error('Failed to fetch rates');
}

async function getRates(base: string): Promise<RatesDoc> {
	const b = base.toLowerCase();
	let timeout = 0;
	let cache: RatesDoc | null = null;
	try {
		timeout = Number(localStorage.getItem(cacheTimeoutKey(b)) || 0);
		cache = safeParseJSON<RatesDoc>(localStorage.getItem(cacheKey(b)));
	} catch {
		/* ignore */
	}
	const rateDate = cache && typeof cache.date === 'string' ? Date.parse(cache.date) : 0;

	if (
		!cache ||
		!timeout ||
		timeout <= Date.now() ||
		!rateDate ||
		rateDate + 24 * 60 * 60 * 1000 <= Date.now()
	) {
		try {
			return await fetchRates(base);
		} catch (error) {
			if (cache) {
				log('using stale cached rates:', error);
				return cache;
			}
			throw error;
		}
	}
	return cache;
}

function detectCurrencyFromMeta(): { abbr: string; sign: string | null } | null {
	const meta = document.querySelector('meta[itemprop="priceCurrency"]') as HTMLMetaElement | null;
	if (meta && meta.content) {
		const abbr = String(meta.content).trim().toUpperCase();
		if (abbr.length === 3) {
			const match = STEAM_CURRENCIES.find((c) => c.abbr === abbr);
			return { abbr, sign: match ? match.symbol : null };
		}
	}
	return null;
}

function detectCurrencyFromWallet(): { abbr: string; sign: string } | null {
	try {
		const w = window as unknown as { g_rgWalletInfo?: { wallet_currency?: number | string } };
		const cur = w.g_rgWalletInfo?.wallet_currency;
		if (cur != null) {
			const currency = findCurrencyById(Number(cur));
			if (currency) return { abbr: currency.abbr, sign: currency.symbol };
		}
	} catch (error) {
		log('wallet detect failed', error);
	}
	return null;
}

function detectCurrencyFromFormatter(): { abbr: string; sign: string } | null {
	try {
		const g = window as unknown as { GStoreItemData?: { fnFormatCurrency?: (v: number) => string } };
		const fn = g.GStoreItemData?.fnFormatCurrency;
		if (typeof fn === 'function') {
			const formatted = String(fn(12345));
			const sign = formatted.replace(/[\d\s .,'’]+/g, '').trim();
			if (sign) {
				const abbr =
					SIGN_TO_CURRENCY[sign] ||
					STEAM_CURRENCIES.find((c) => c.symbol === sign)?.abbr ||
					null;
				if (abbr) return { abbr, sign };
			}
		}
	} catch (error) {
		log('formatter detect failed', error);
	}
	return null;
}

function detectCurrentCurrency(): { abbr: string; sign: string | null } | null {
	return (
		detectCurrencyFromMeta() ||
		detectCurrencyFromWallet() ||
		detectCurrencyFromFormatter() ||
		null
	);
}

function formatTarget(value: number): string {
	const rounded = Math.ceil(value);
	try {
		return new Intl.NumberFormat(undefined, {
			style: 'currency',
			currency: targetCurrency,
			maximumFractionDigits: 0,
		}).format(rounded);
	} catch {
		return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(rounded)} ${targetCurrency}`;
	}
}

function textContainsSupportedCurrency(text: string): boolean {
	if (!text) return false;
	if (sourceCurrencySign && text.includes(sourceCurrencySign)) return true;
	return Object.keys(SIGN_TO_CURRENCY).some((sign) => text.includes(sign));
}

function alreadyConverted(element: Element): boolean {
	const text = (element as HTMLElement).innerText || element.textContent || '';
	return element.getAttribute('data-scc-done') === '1' || text.includes('≈');
}

function shouldSkip(element: Element): boolean {
	if (!(element instanceof HTMLElement)) return true;
	if (alreadyConverted(element)) return true;

	const classList = String(element.className || '');
	if (classList.includes('discount_original_price')) return true;
	if (classList.includes('es-regprice') || classList.includes('es-converted')) return true;
	if (classList.includes('your_price_label')) return true;
	if (classList.includes('spotlight_body') || classList.includes('similar_grid_price')) return true;
	if (classList.includes('market_table_value')) return true;

	const ownText = element.innerText || element.textContent || '';
	const parentText = element.parentElement
		? element.parentElement.innerText || element.parentElement.textContent || ''
		: '';
	return !textContainsSupportedCurrency(ownText) && !textContainsSupportedCurrency(parentText);
}

// Format-agnostic number parse: handles "1,234.56" (US/UK), "1.234,56" (EU)
// and "1 199" (no decimals). The last separator by position is the decimal
// one, if it is followed by 1-2 digits.
function parseNumeric(raw: string): number | null {
	let s = String(raw).replace(/[^0-9.,]/g, '');
	if (!s) return null;

	const lastComma = s.lastIndexOf(',');
	const lastDot = s.lastIndexOf('.');
	let decSep: ',' | '.' | null = null;

	if (lastComma > -1 && lastDot > -1) {
		decSep = lastComma > lastDot ? ',' : '.';
	} else if (lastComma > -1) {
		const digitsAfter = s.length - lastComma - 1;
		if (s.indexOf(',') === lastComma && (digitsAfter === 1 || digitsAfter === 2)) decSep = ',';
	} else if (lastDot > -1) {
		const digitsAfter = s.length - lastDot - 1;
		if (s.indexOf('.') === lastDot && (digitsAfter === 1 || digitsAfter === 2)) decSep = '.';
	}

	if (decSep) {
		const thouSep = decSep === ',' ? '.' : ',';
		s = s.split(thouSep).join('').replace(decSep, '.');
	} else {
		s = s.replace(/[.,]/g, '');
	}

	const value = Number(s);
	return Number.isFinite(value) && value > 0 ? value : null;
}

function parsePrice(element: HTMLElement): number | null {
	const priceFinal = element.dataset ? element.dataset.priceFinal : undefined;
	if (priceFinal) {
		const value = Number(priceFinal) / 100;
		return Number.isFinite(value) && value > 0 ? value : null;
	}

	const clone = element.cloneNode(true) as HTMLElement;
	clone.querySelectorAll('strike').forEach((s) => s.remove());

	const line = (clone.innerText || clone.textContent || '').trim().split(/\r?\n|\r|\n/g)[0];
	return parseNumeric(line);
}

function injectPrice(element: HTMLElement, forceInline = false): void {
	if (shouldSkip(element)) return;
	if (!sourceCurrency || rate == null) return;

	const price = parsePrice(element);
	if (!price) return;

	const convertedText = `≈${formatTarget(price * rate)}`;

	let inline = forceInline;
	const classList = String(element.className || '');
	if (
		element.id === 'marketWalletBalanceAmount' ||
		classList.includes('market_listing_price_with_fee') ||
		classList.includes('market_activity_price')
	) {
		inline = true;
	}
	if (
		element.parentElement?.parentElement &&
		String(element.parentElement.parentElement.className || '').includes('item_market_actions')
	) {
		inline = true;
	}

	if (inline) {
		element.append(' ', makeSpan('scc-inline', `(${convertedText})`));
	} else {
		const originalText = (element.innerText || element.textContent || '').replace('ARS$ ', '$').trim();
		element.textContent = '';
		element.append(makeSpan('scc-original', originalText), makeSpan('scc-block', convertedText));
	}

	element.setAttribute('data-scc-done', '1');
}

function scanLooseCartPrices(root: Document | HTMLElement): void {
	if (!sourceCurrencySign) return;
	if (!EXTRA_SCAN_PATHS.some((p) => location.pathname.startsWith(p))) return;

	const sign = sourceCurrencySign;
	const start: Node = root.nodeType === 1 ? root : document.body;
	const walker = document.createTreeWalker(start, NodeFilter.SHOW_ELEMENT);
	const targets: HTMLElement[] = [];

	let node: Node | null = walker.currentNode;
	while (node) {
		if (node instanceof HTMLElement && node.childElementCount === 0 && !node.hasAttribute('data-scc-done')) {
			const text = (node.textContent || '').trim();
			if (
				text.length > 0 &&
				text.length <= 24 &&
				text.includes(sign) &&
				/\d/.test(text) &&
				!/[A-Za-zА-Яа-яЁё]{3,}/.test(text.split(sign).join(' '))
			) {
				targets.push(node);
			}
		}
		node = walker.nextNode();
	}

	for (const el of targets) {
		try {
			injectPrice(el, true);
		} catch (error) {
			log('cart inject error', error, el);
		}
	}
}

function runInjection(root: Document | HTMLElement = document): void {
	if (!sourceCurrency || rate == null) return;

	const prices = root.querySelectorAll<HTMLElement>(SELECTORS);
	for (const priceNode of Array.from(prices)) {
		try {
			injectPrice(priceNode);
		} catch (error) {
			log('inject error', error, priceNode);
		}
	}
	scanLooseCartPrices(root);
}

function scheduleInjection(): void {
	if (injectScheduled) return;
	injectScheduled = true;
	requestAnimationFrame(() => {
		injectScheduled = false;
		runInjection(document);
	});
}

function startObserver(): void {
	if (observerStarted || !document.body) return;
	observerStarted = true;

	const observer = new MutationObserver(() => scheduleInjection());
	observer.observe(document.body, { childList: true, subtree: true });

	setTimeout(scheduleInjection, 1000);
	setTimeout(scheduleInjection, 2500);
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

const TARGET_CACHE_KEY = 'scc_target_currency';

function readCachedTarget(): string | null {
	try {
		const v = localStorage.getItem(TARGET_CACHE_KEY);
		return v && /^[A-Z]{3}$/.test(v) ? v : null;
	} catch {
		return null;
	}
}

/** Ask the backend for the chosen currency, retrying past the startup race. */
async function fetchTargetFromBackend(): Promise<string | null> {
	for (let attempt = 0; attempt < 8; attempt++) {
		try {
			const parsed = safeParseJSON<{ target_currency?: string }>(await getSettings());
			const t = parsed?.target_currency;
			if (typeof t === 'string' && /^[A-Za-z]{3}$/.test(t)) {
				const code = t.toUpperCase();
				try {
					localStorage.setItem(TARGET_CACHE_KEY, code);
				} catch {
					/* ignore */
				}
				return code;
			}
			return 'RUB';
		} catch {
			await delay(600);
		}
	}
	return null;
}

async function resolveTargetCurrency(): Promise<string> {
	// Always ask the backend first (retries past the startup race). Only if it
	// never answers do we fall back to the last known value, then to RUB.
	const fresh = await fetchTargetFromBackend();
	if (fresh) return fresh;
	const cached = readCachedTarget();
	if (cached) {
		log('backend unavailable, using last known target', cached);
		return cached;
	}
	log('settings unavailable, defaulting to RUB');
	return 'RUB';
}

async function run(): Promise<void> {
	const host = String(location.hostname || '').toLowerCase();
	if (host !== 'store.steampowered.com' && host !== 'steamcommunity.com') return;

	try {
		addStyles();

		targetCurrency = await resolveTargetCurrency();

		const detected = detectCurrentCurrency();
		sourceCurrency = detected ? detected.abbr : null;
		sourceCurrencySign = detected ? detected.sign : null;
		log('source:', sourceCurrency, 'sign:', sourceCurrencySign, 'target:', targetCurrency);

		if (!sourceCurrency) throw new Error('No source currency detected');
		if (sourceCurrency === targetCurrency) {
			log('source == target, nothing to do');
			return;
		}

		const rates = await getRates(targetCurrency);
		const base = rates[targetCurrency.toLowerCase()];
		const rawRate =
			base && typeof base === 'object' ? (base as Record<string, number>)[sourceCurrency.toLowerCase()] : null;
		if (!rawRate || !Number.isFinite(rawRate) || rawRate <= 0) {
			throw new Error(`Rate not found for ${sourceCurrency} -> ${targetCurrency}`);
		}

		// currency-api gives "1 target = rawRate source"; we need source -> target.
		rate = 1 / rawRate;
		log('effective rate (1 ' + sourceCurrency + ' =', rate, targetCurrency + ')');

		runInjection(document);
		startObserver();
	} catch (error) {
		log('fatal error', error);
	}
}

export default async function main(): Promise<void> {
	if (document.readyState === 'loading') {
		await new Promise<void>((resolve) =>
			window.addEventListener('DOMContentLoaded', () => resolve(), { once: true }),
		);
	}
	await run();
}
