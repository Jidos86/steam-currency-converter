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
	'.match_price',
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
	// Inventory item panel (legacy layout)
	'.item_market_actions > div',
	'.market_commodity_orders_header_promote',
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
		.scc-hint {
			margin-left: 6px;
			white-space: nowrap;
			opacity: 0.85;
			font-size: 90%;
			font-weight: normal;
		}
		.discount_block .scc-hint,
		[class*=StoreSalePriceWidgetContainer] .scc-hint { display: inline-block; }
		/* narrow instant-search dropdown: put the hint on its own line */
		.match_price .scc-hint,
		[id^=searchSuggestions] .scc-hint { display: block; margin-left: 0; }
		.tab_item_discount { width: 190px !important; }
		.home_marketing_message.small .discount_block { height: auto !important; }
		.curator #RecommendationsRows .store_capsule.price_inline .discount_block { min-width: 220px !important; }
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

const SOURCE_CACHE_KEY = 'scc_source_currency';

/** Last currency detected from an authoritative source, reused on pages that
 *  expose neither the wallet id nor the priceCurrency meta (e.g. /search). */
function detectCurrencyFromCache(): { abbr: string; sign: string | null } | null {
	try {
		const abbr = (localStorage.getItem(SOURCE_CACHE_KEY) || '').toUpperCase();
		const match = STEAM_CURRENCIES.find((c) => c.abbr === abbr);
		if (match) return { abbr: match.abbr, sign: match.symbol };
	} catch {
		/* ignore */
	}
	return null;
}

// Source currency is only ever taken from unambiguous sources: the wallet id,
// the schema.org priceCurrency meta, or a value one of those produced earlier
// (cached). A symbol-based guess is deliberately not used — ¥ is JPY *and* CNY,
// kr is NOK *and* SEK — a silently wrong rate is worse than not converting.
function detectCurrentCurrency(): { abbr: string; sign: string | null } | null {
	const authoritative = detectCurrencyFromWallet() || detectCurrencyFromMeta();
	if (authoritative) {
		try {
			localStorage.setItem(SOURCE_CACHE_KEY, authoritative.abbr);
		} catch {
			/* ignore */
		}
		return authoritative;
	}
	return detectCurrencyFromCache();
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

function isStruck(el: Element): boolean {
	try {
		return window.getComputedStyle(el).textDecorationLine.includes('line-through');
	} catch {
		return false;
	}
}

function shouldSkip(element: Element): boolean {
	if (!(element instanceof HTMLElement)) return true;
	if (alreadyConverted(element)) return true;
	// A parent or child was already converted (covers MutationObserver re-runs).
	if (element.parentElement?.closest('[data-scc-done="1"]')) return true;
	if (element.querySelector('[data-scc-done="1"]')) return true;

	const classList = String(element.className || '');
	if (classList.includes('discount_original_price')) return true;
	if (classList.includes('es-regprice') || classList.includes('es-converted')) return true;
	if (classList.includes('your_price_label')) return true;
	if (classList.includes('spotlight_body') || classList.includes('similar_grid_price')) return true;
	if (classList.includes('market_table_value')) return true;

	// Struck-through text is the pre-discount original price — skip it
	// (covers React widgets where the class is hashed).
	if (isStruck(element) || (element.parentElement && isStruck(element.parentElement))) return true;

	const ownText = element.innerText || element.textContent || '';

	// Has a currency sign in its own text — convert it.
	if (textContainsSupportedCurrency(ownText)) return false;

	// No currency sign of its own: only convert when it's a bare price number
	// (a discount block puts the final price in its own symbol-less node) and a
	// parent shows the currency. Labels like "Sold in 24h: 196" are skipped.
	const bare = ownText.trim();
	const looksBarePrice = bare.length > 0 && bare.length <= 16 && !/[^\d.,\s  ]/.test(bare);
	const parentText = element.parentElement
		? element.parentElement.innerText || element.parentElement.textContent || ''
		: '';
	return !(looksBarePrice && textContainsSupportedCurrency(parentText));
}

// Format-agnostic number parse: handles "1,234.56" (US/UK), "1.234,56" (EU)
// and "1 199" (no decimals). The last separator by position is the decimal
// one, if it is followed by 1-2 digits.
// No single Steam purchase costs more than this in any wallet currency; a
// larger value means several prices got concatenated (a discount block).
const MAX_PRICE = 10_000_000;

/** Turn one number-like token ("1,234.56" / "1.234,56" / "1 199") into a number. */
function tokenToNumber(token: string): number | null {
	let s = token.replace(/[^\d.,]/g, '');
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

// A discount block reads "-15% ¥98.00 ¥83.30" — several numbers separated by
// the currency symbol / percent. Take the LAST plausible price token (the
// final price comes after the struck original), never the concatenation.
function parseNumeric(raw: string): number | null {
	const line = String(raw).split(/\r?\n/).find((l) => /\d/.test(l)) ?? String(raw);
	const tokens = line.match(/\d[\d.,   ]*\d|\d/g);
	if (!tokens) return null;

	for (let i = tokens.length - 1; i >= 0; i--) {
		const value = tokenToNumber(tokens[i]);
		if (value != null && value <= MAX_PRICE) return value;
	}
	return null;
}

function parsePrice(element: HTMLElement): number | null {
	const priceFinal = element.dataset ? element.dataset.priceFinal : undefined;
	if (priceFinal) {
		const value = Number(priceFinal) / 100;
		return Number.isFinite(value) && value > 0 ? value : null;
	}

	const clone = element.cloneNode(true) as HTMLElement;
	// Drop the struck original price and the "-NN%" badge so a discount block
	// leaves only the final price behind.
	clone
		.querySelectorAll(
			'strike, del, s, .discount_original_price, .discount_pct, .includes_games, ' +
				'[class*=StrikeThrough], [class*=OriginalPrice], [class*=DiscountPct], [class*=Discount_Percentage]',
		)
		.forEach((n) => n.remove());

	// Prefer an explicit final-price node when the block exposes one.
	const finalNode = clone.querySelector<HTMLElement>(
		'.discount_final_price, [class*=SalePrice], [class*=FinalPrice]',
	);
	const target = finalNode ?? clone;
	return parseNumeric(target.innerText || target.textContent || '');
}

function injectPrice(element: HTMLElement, forceInline = false): void {
	if (shouldSkip(element)) return;
	if (!sourceCurrency || rate == null) return;

	const price = parsePrice(element);
	if (!price) return;

	const convertedText = `≈${formatTarget(price * rate)}`;

	const classList = String(element.className || '');
	const parenthesize =
		forceInline ||
		element.id === 'marketWalletBalanceAmount' ||
		classList.includes('market_listing_price_with_fee') ||
		classList.includes('market_activity_price') ||
		String(element.parentElement?.parentElement?.className || '').includes('item_market_actions');

	// Never rewrite the element's content — just append the hint, so Steam's
	// own markup (discount badge, strikethrough, layout) stays intact.
	element.append(' ', makeSpan('scc-hint', parenthesize ? `(${convertedText})` : convertedText));
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

// The client's instant-search dropdown is a React component with hashed
// classes. Anchor on the stable #searchSuggestions… container and each app
// link, then convert the last price-bearing leaf in the row (the final
// discounted price comes after the struck original).
function scanSearchSuggest(root: Document | HTMLElement): void {
	if (!sourceCurrencySign) return;
	const sign = sourceCurrencySign;
	const scope = root instanceof Element ? root : document;

	for (const box of Array.from(scope.querySelectorAll('[id^=searchSuggestions], .search_suggest, #search_suggestion_contents'))) {
		for (const row of Array.from(box.querySelectorAll<HTMLElement>('a[href*="/app/"], a[href*="/bundle/"], a.match'))) {
			const leaves = Array.from(row.querySelectorAll<HTMLElement>('*')).filter(
				(el) =>
					el.childElementCount === 0 &&
					(el.textContent || '').includes(sign) &&
					/\d/.test(el.textContent || ''),
			);
			const last = leaves[leaves.length - 1];
			if (last && !last.hasAttribute('data-scc-done')) {
				try {
					injectPrice(last, false);
				} catch (error) {
					log('suggest inject error', error, last);
				}
			}
		}
	}
}

// The React inventory has fully hashed class names. Anchor on the stable
// "market/listings" link and convert the price line(s) next to it.
function scanInventoryPrices(root: Document | HTMLElement): void {
	if (!sourceCurrencySign || !location.pathname.includes('/inventory')) return;
	const sign = sourceCurrencySign;
	const scope = root instanceof Element ? root : document;

	for (const link of Array.from(scope.querySelectorAll<HTMLAnchorElement>('a[href*="/market/listings/"]'))) {
		const container = link.parentElement;
		if (!container) continue;
		for (const div of Array.from(container.querySelectorAll<HTMLElement>('div'))) {
			if (
				div.childElementCount === 0 &&
				!div.hasAttribute('data-scc-done') &&
				(div.textContent || '').includes(sign) &&
				/\d/.test(div.textContent || '')
			) {
				try {
					injectPrice(div, true);
				} catch (error) {
					log('inventory inject error', error, div);
				}
			}
		}
	}
}

// New Steam UI widgets (recommendations, feeds, capsules) are React with
// hashed class names, but the price is always a leaf element whose text is
// exactly a price in the wallet currency. Convert those directly.
const BARE_PRICE_RE = /^[^\p{L}\n]*$/u;

function scanBarePrices(root: Document | HTMLElement): void {
	if (!sourceCurrencySign) return;
	const sign = sourceCurrencySign;
	const scope = root instanceof Element ? root : document.body;

	let leaves: NodeListOf<HTMLElement>;
	try {
		leaves = scope.querySelectorAll<HTMLElement>(
			'span:not(:has(*)):not([data-scc-done]), div:not(:has(*)):not([data-scc-done]), p:not(:has(*)):not([data-scc-done])',
		);
	} catch {
		return; // :has unsupported
	}

	for (const el of Array.from(leaves)) {
		const t = (el.textContent || '').trim();
		if (t.length < 2 || t.length > 18 || !t.includes(sign) || !/\d/.test(t)) continue;
		if (!BARE_PRICE_RE.test(t.split(sign).join(' '))) continue; // sign + number, no words
		try {
			injectPrice(el, false);
		} catch (error) {
			log('bare price inject error', error, el);
		}
	}
}

function runInjection(root: Document | HTMLElement = document): void {
	if (!sourceCurrency || rate == null) return;

	const prices = Array.from(root.querySelectorAll<HTMLElement>(SELECTORS));
	// When selectors match both a price element and one of its ancestors,
	// keep only the innermost so the hint is appended once.
	const innermost = prices.filter((el) => !prices.some((other) => other !== el && el.contains(other)));
	for (const priceNode of innermost) {
		try {
			injectPrice(priceNode);
		} catch (error) {
			log('inject error', error, priceNode);
		}
	}
	scanLooseCartPrices(root);
	scanInventoryPrices(root);
	scanSearchSuggest(root);
	scanBarePrices(root);
}

let followupTimer = 0;

function scheduleInjection(): void {
	if (!injectScheduled) {
		injectScheduled = true;
		requestAnimationFrame(() => {
			injectScheduled = false;
			runInjection(document);
		});
	}
	// Prices often load asynchronously into elements that already exist (the
	// inventory market price, lazy capsules). Re-scan shortly after the batch.
	if (followupTimer) clearTimeout(followupTimer);
	followupTimer = window.setTimeout(() => {
		followupTimer = 0;
		runInjection(document);
	}, 500);
}

function startObserver(): void {
	if (observerStarted || !document.body) return;
	observerStarted = true;

	const observer = new MutationObserver(() => scheduleInjection());
	observer.observe(document.body, { childList: true, subtree: true, characterData: true });

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

let setupDone = false;

/** Detect the source currency and resolve the rate. Returns false while the
 *  page hasn't exposed g_rgWalletInfo / the priceCurrency meta yet. */
async function ensureSetup(): Promise<boolean> {
	if (setupDone) return true;

	const detected = detectCurrentCurrency();
	if (!detected) return false;

	sourceCurrency = detected.abbr;
	sourceCurrencySign = detected.sign;

	if (sourceCurrency === targetCurrency) {
		log('source == target, nothing to do');
		setupDone = true;
		return true;
	}

	try {
		const rates = await getRates(targetCurrency);
		const base = rates[targetCurrency.toLowerCase()];
		const rawRate =
			base && typeof base === 'object' ? (base as Record<string, number>)[sourceCurrency.toLowerCase()] : null;
		if (!rawRate || !Number.isFinite(rawRate) || rawRate <= 0) {
			log('rate not found for', sourceCurrency, '->', targetCurrency);
			return false;
		}
		// currency-api gives "1 target = rawRate source"; we need source -> target.
		rate = 1 / rawRate;
		setupDone = true;
		log('source:', sourceCurrency, 'target:', targetCurrency, 'rate 1', sourceCurrency, '=', rate, targetCurrency);
		return true;
	} catch (error) {
		log('rate fetch failed', error);
		return false;
	}
}

async function run(): Promise<void> {
	const host = String(location.hostname || '').toLowerCase();
	if (host !== 'store.steampowered.com' && host !== 'steamcommunity.com') return;

	addStyles();
	targetCurrency = await resolveTargetCurrency();

	// The store home / feeds expose the wallet currency asynchronously — retry
	// while the page finishes loading rather than giving up after one try.
	for (let attempt = 0; attempt < 30 && !setupDone; attempt++) {
		if (await ensureSetup()) break;
		await delay(500);
	}

	startObserver(); // harmless before setup — runInjection no-ops until the rate is ready

	if (setupDone) {
		runInjection(document);
	} else {
		log('currency not detected yet, will keep trying');
		const iv = window.setInterval(async () => {
			if (await ensureSetup()) {
				window.clearInterval(iv);
				runInjection(document);
			}
		}, 2000);
		window.setTimeout(() => window.clearInterval(iv), 120000);
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
