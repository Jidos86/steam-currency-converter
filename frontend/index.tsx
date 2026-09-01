/**
 * Steam Currency Converter — settings panel.
 *
 * The chosen currency lives in the lua backend (millennium.config). This
 * panel reads it via the `get_settings` callable and writes it via
 * `set_target_currency` — the same IPC path the webkit module uses, since
 * usePluginConfig / pluginConfig were unreliable in this Millennium build.
 */
import { Dropdown, Field, IconsModule, callable, definePlugin } from '@steambrew/client';
import { useEffect, useState } from 'react';

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

function parseTarget(raw: string): string | null {
	try {
		const value = (JSON.parse(raw) as { target_currency?: unknown }).target_currency;
		const code = typeof value === 'string' ? value.toUpperCase() : '';
		return KNOWN_CODES.has(code) ? code : null;
	} catch {
		return null;
	}
}

const SettingsContent = () => {
	// null = still loading the saved value from the backend.
	const [selected, setSelected] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		void (async () => {
			for (let attempt = 0; attempt < 6 && !cancelled; attempt++) {
				try {
					const code = parseTarget(await getSettings());
					if (!cancelled) setSelected(code ?? DEFAULT_TARGET);
					return;
				} catch {
					await new Promise((r) => setTimeout(r, 500));
				}
			}
			if (!cancelled) setSelected(DEFAULT_TARGET);
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

	return (
		<div style={{ padding: '16px' }}>
			<Field
				label="Target currency"
				description="Currency to show an approximate price in, next to the original Steam price. Takes effect after Steam is restarted."
				icon={<IconsModule.Settings />}
				childrenLayout="below"
				bottomSeparator="none"
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
		</div>
	);
};

export default definePlugin(() => ({
	// `title` is required by the ttc runtime to register the settings panel.
	title: 'Steam Currency Converter',
	icon: <IconsModule.Settings />,
	content: <SettingsContent />,
}));
