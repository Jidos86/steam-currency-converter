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

/** Every Steam wallet currency, usable as a conversion target. Sorted by name. */
const TARGET_CURRENCIES: { code: string; name: string }[] = [
	{ code: 'ARS', name: 'Argentine peso' },
	{ code: 'AUD', name: 'Australian dollar' },
	{ code: 'BYN', name: 'Belarusian ruble' },
	{ code: 'BRL', name: 'Brazilian real' },
	{ code: 'CAD', name: 'Canadian dollar' },
	{ code: 'CLP', name: 'Chilean peso' },
	{ code: 'CNY', name: 'Chinese yuan' },
	{ code: 'COP', name: 'Colombian peso' },
	{ code: 'CRC', name: 'Costa Rican colón' },
	{ code: 'EUR', name: 'Euro' },
	{ code: 'HKD', name: 'Hong Kong dollar' },
	{ code: 'INR', name: 'Indian rupee' },
	{ code: 'IDR', name: 'Indonesian rupiah' },
	{ code: 'ILS', name: 'Israeli shekel' },
	{ code: 'JPY', name: 'Japanese yen' },
	{ code: 'KZT', name: 'Kazakhstani tenge' },
	{ code: 'KWD', name: 'Kuwaiti dinar' },
	{ code: 'MYR', name: 'Malaysian ringgit' },
	{ code: 'MXN', name: 'Mexican peso' },
	{ code: 'TWD', name: 'New Taiwan dollar' },
	{ code: 'NZD', name: 'New Zealand dollar' },
	{ code: 'NOK', name: 'Norwegian krone' },
	{ code: 'PEN', name: 'Peruvian sol' },
	{ code: 'PHP', name: 'Philippine peso' },
	{ code: 'PLN', name: 'Polish złoty' },
	{ code: 'GBP', name: 'Pound sterling' },
	{ code: 'QAR', name: 'Qatari riyal' },
	{ code: 'RUB', name: 'Russian ruble' },
	{ code: 'SAR', name: 'Saudi riyal' },
	{ code: 'SGD', name: 'Singapore dollar' },
	{ code: 'ZAR', name: 'South African rand' },
	{ code: 'KRW', name: 'South Korean won' },
	{ code: 'SEK', name: 'Swedish krona' },
	{ code: 'CHF', name: 'Swiss franc' },
	{ code: 'THB', name: 'Thai baht' },
	{ code: 'TRY', name: 'Turkish lira' },
	{ code: 'AED', name: 'UAE dirham' },
	{ code: 'UAH', name: 'Ukrainian hryvnia' },
	{ code: 'USD', name: 'US dollar' },
	{ code: 'UYU', name: 'Uruguayan peso' },
	{ code: 'VND', name: 'Vietnamese dong' },
].sort((a, b) => a.name.localeCompare(b.name));

const OPTIONS = TARGET_CURRENCIES.map((c) => ({ data: c.code, label: `${c.name} (${c.code})` }));
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
		setSelected(code); // optimistic — local state drives the UI
		void setTargetCurrency({ currency: code }).catch((e: unknown) => {
			console.error('[Steam Currency Converter] failed to save target currency', e);
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
