export interface SteamCurrency {
	id: number;
	abbr: string;
	symbol: string;
}

// Full Steam wallet currency table: id -> { abbr, symbol }.
// Symbols identify price text. The wallet currency itself comes from Steam.
export const STEAM_CURRENCIES: SteamCurrency[] = [
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

export function findCurrencyById(id: number): SteamCurrency | null {
	return STEAM_CURRENCIES.find((c) => c.id === id) ?? null;
}
