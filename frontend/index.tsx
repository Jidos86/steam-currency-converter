/**
 * Steam Currency Converter — settings panel.
 *
 * Settings live in the Lua backend (millennium.config). The panel and webkit
 * module both read them via the `get_settings` callable.
 */
import { Dropdown, Field, IconsModule, callable, definePlugin } from '@steambrew/client';
import { useEffect, useState } from 'react';
import { WalletBalance } from './wallet-balance';

/** @ffi */
export const walletHooks = { WalletBalance };

const DEFAULT_TARGET = 'RUB';

/** Every Steam wallet currency, usable as a conversion target. Sorted by country. */
const TARGET_CURRENCIES: { code: string; country: string }[] = [
	{ code: 'ARS', country: 'Argentina' },
	{ code: 'AUD', country: 'Australia' },
	{ code: 'BYN', country: 'Belarus' },
	{ code: 'BRL', country: 'Brazil' },
	{ code: 'CAD', country: 'Canada' },
	{ code: 'CLP', country: 'Chile' },
	{ code: 'CNY', country: 'China' },
	{ code: 'COP', country: 'Colombia' },
	{ code: 'CRC', country: 'Costa Rica' },
	{ code: 'EUR', country: 'Eurozone' },
	{ code: 'HKD', country: 'Hong Kong' },
	{ code: 'INR', country: 'India' },
	{ code: 'IDR', country: 'Indonesia' },
	{ code: 'ILS', country: 'Israel' },
	{ code: 'JPY', country: 'Japan' },
	{ code: 'KZT', country: 'Kazakhstan' },
	{ code: 'KWD', country: 'Kuwait' },
	{ code: 'MYR', country: 'Malaysia' },
	{ code: 'MXN', country: 'Mexico' },
	{ code: 'NZD', country: 'New Zealand' },
	{ code: 'NOK', country: 'Norway' },
	{ code: 'PEN', country: 'Peru' },
	{ code: 'PHP', country: 'Philippines' },
	{ code: 'PLN', country: 'Poland' },
	{ code: 'QAR', country: 'Qatar' },
	{ code: 'RUB', country: 'Russia' },
	{ code: 'SAR', country: 'Saudi Arabia' },
	{ code: 'SGD', country: 'Singapore' },
	{ code: 'ZAR', country: 'South Africa' },
	{ code: 'KRW', country: 'South Korea' },
	{ code: 'SEK', country: 'Sweden' },
	{ code: 'CHF', country: 'Switzerland' },
	{ code: 'TWD', country: 'Taiwan' },
	{ code: 'THB', country: 'Thailand' },
	{ code: 'TRY', country: 'Türkiye' },
	{ code: 'AED', country: 'United Arab Emirates' },
	{ code: 'GBP', country: 'United Kingdom' },
	{ code: 'USD', country: 'United States' },
	{ code: 'UAH', country: 'Ukraine' },
	{ code: 'UYU', country: 'Uruguay' },
	{ code: 'VND', country: 'Vietnam' },
].sort((a, b) => a.country.localeCompare(b.country));

const OPTIONS = TARGET_CURRENCIES.map((c) => ({ data: c.code, label: `${c.country} (${c.code})` }));
const KNOWN_CODES = new Set(TARGET_CURRENCIES.map((c) => c.code));

const getSettings = callable<[], string>('get_settings');
const setTargetCurrency = callable<[{ currency: string }], string>('set_target_currency');
const setRateSource = callable<[{ source: string }], string>('set_rate_source');
const SOURCE_OPTIONS = [
	{ data: 'currency_api', label: 'Currency API' },
	{ data: 'freedom_bank', label: 'Freedom Bank' },
];

const SettingsContent = () => {
	// null = still loading the saved value from the backend.
	const [selected, setSelected] = useState<string | null>(null);
	const [source, setSource] = useState<string | null>(null);
	const [savingSource, setSavingSource] = useState(false);
	const [sourceSaveFailed, setSourceSaveFailed] = useState(false);

	useEffect(() => {
		let cancelled = false;
		void (async () => {
			for (let attempt = 0; attempt < 6 && !cancelled; attempt++) {
				try {
					const settings = JSON.parse(await getSettings());
					const target = settings?.target_currency;
					const code = typeof target === 'string' ? target.toUpperCase() : '';
					if (!cancelled) {
						setSelected(KNOWN_CODES.has(code) ? code : DEFAULT_TARGET);
						setSource(settings?.rate_source === 'freedom_bank' ? 'freedom_bank' : 'currency_api');
					}
					return;
				} catch {
					await new Promise((r) => setTimeout(r, 500));
				}
			}
			if (!cancelled) {
				setSelected(DEFAULT_TARGET);
				setSource('currency_api');
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	const handleChange = (code: string) => {
		if (!KNOWN_CODES.has(code)) return;
		const previous = selected;
		setSelected(code); // optimistic — local state drives the UI
		void setTargetCurrency({ currency: code }).catch((e: unknown) => {
			console.error('[Steam Currency Converter] failed to save target currency', e);
			setSelected(previous); // roll back on failure
		});
	};

	const handleSourceChange = async (value: string) => {
		if (savingSource || value === source || !SOURCE_OPTIONS.some((option) => option.data === value)) return;
		const previous = source;
		setSource(value);
		setSavingSource(true);
		setSourceSaveFailed(false);
		try {
			const saved = JSON.parse(await setRateSource({ source: value }));
			if (saved?.rate_source !== value) throw new Error('Rate source was not saved');
		} catch (error) {
			console.error('[Steam Currency Converter] failed to save rate source', error);
			setSource(previous);
			setSourceSaveFailed(true);
		} finally {
			setSavingSource(false);
		}
	};

	return (
		<div style={{ padding: '16px' }}>
			<Field
				label="Target currency"
				description="Currency to show an approximate price in, next to the original Steam price. Takes effect after Steam is restarted."
				icon={<IconsModule.Settings />}
				childrenLayout="below"
			>
				{selected !== null && (
					// Steam's Dropdown keeps its own selection state and ignores
					// `selectedOption` after mount — remount via `key` on change.
					<Dropdown
						key={selected}
						rgOptions={OPTIONS}
						selectedOption={selected}
						onChange={(option) => handleChange(String(option.data))}
					/>
				)}
			</Field>
			<Field
				label="Preferred exchange rate source"
				description="Uses the other source when the preferred source is unavailable or has no rate for the currency pair. Takes effect after Steam is restarted."
				childrenLayout="below"
				bottomSeparator="none"
			>
				{source !== null && (
					<Dropdown
						key={source}
						rgOptions={SOURCE_OPTIONS}
						selectedOption={source}
						disabled={savingSource}
						onChange={(option) => void handleSourceChange(String(option.data))}
					/>
				)}
				{sourceSaveFailed && <div role="alert">Could not save the exchange rate source.</div>}
			</Field>
		</div>
	);
};

export default definePlugin(() => ({
	// `title` is required by the ttc runtime to register the settings panel.
	title: 'Steam Currency Converter',
	icon: <IconsModule.Settings />,
	content: <SettingsContent />,
}));
