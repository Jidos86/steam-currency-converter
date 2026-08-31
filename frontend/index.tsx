/**
 * Steam Currency Converter — settings panel.
 *
 * A single dropdown that picks the target currency. The value is stored in
 * the plugin config; the lua backend reads it back and hands it to the
 * webkit module (see backend/main.lua -> get_settings).
 */
import { Dropdown, Field, IconsModule, definePlugin, pluginConfig } from '@steambrew/client';
import { useEffect, useState } from 'react';

const DEFAULT_TARGET = 'RUB';

/** Every Steam wallet currency, usable as a conversion target. */
const TARGET_CURRENCIES: { code: string; name: string }[] = [
	{ code: 'RUB', name: 'Russian ruble' },
	{ code: 'USD', name: 'US dollar' },
	{ code: 'EUR', name: 'Euro' },
	{ code: 'GBP', name: 'Pound sterling' },
	{ code: 'CHF', name: 'Swiss franc' },
	{ code: 'PLN', name: 'Polish złoty' },
	{ code: 'BRL', name: 'Brazilian real' },
	{ code: 'JPY', name: 'Japanese yen' },
	{ code: 'NOK', name: 'Norwegian krone' },
	{ code: 'IDR', name: 'Indonesian rupiah' },
	{ code: 'MYR', name: 'Malaysian ringgit' },
	{ code: 'PHP', name: 'Philippine peso' },
	{ code: 'SGD', name: 'Singapore dollar' },
	{ code: 'THB', name: 'Thai baht' },
	{ code: 'VND', name: 'Vietnamese dong' },
	{ code: 'KRW', name: 'South Korean won' },
	{ code: 'TRY', name: 'Turkish lira' },
	{ code: 'UAH', name: 'Ukrainian hryvnia' },
	{ code: 'MXN', name: 'Mexican peso' },
	{ code: 'CAD', name: 'Canadian dollar' },
	{ code: 'AUD', name: 'Australian dollar' },
	{ code: 'CNY', name: 'Chinese yuan' },
	{ code: 'INR', name: 'Indian rupee' },
	{ code: 'CLP', name: 'Chilean peso' },
	{ code: 'PEN', name: 'Peruvian sol' },
	{ code: 'COP', name: 'Colombian peso' },
	{ code: 'ZAR', name: 'South African rand' },
	{ code: 'HKD', name: 'Hong Kong dollar' },
	{ code: 'TWD', name: 'New Taiwan dollar' },
	{ code: 'SAR', name: 'Saudi riyal' },
	{ code: 'AED', name: 'UAE dirham' },
	{ code: 'SEK', name: 'Swedish krona' },
	{ code: 'ARS', name: 'Argentine peso' },
	{ code: 'ILS', name: 'Israeli shekel' },
	{ code: 'BYN', name: 'Belarusian ruble' },
	{ code: 'KZT', name: 'Kazakhstani tenge' },
	{ code: 'KWD', name: 'Kuwaiti dinar' },
	{ code: 'QAR', name: 'Qatari riyal' },
	{ code: 'CRC', name: 'Costa Rican colón' },
	{ code: 'UYU', name: 'Uruguayan peso' },
];

const OPTIONS = TARGET_CURRENCIES.map((c) => ({ data: c.code, label: `${c.name} (${c.code})` }));

const KNOWN_CODES = new Set(TARGET_CURRENCIES.map((c) => c.code));

const SettingsContent = () => {
	// null = still loading the saved value from plugin config.
	const [selected, setSelected] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		void pluginConfig
			.get<string>('target_currency')
			.then((value) => {
				if (cancelled) return;
				const code = typeof value === 'string' ? value.toUpperCase() : '';
				setSelected(KNOWN_CODES.has(code) ? code : DEFAULT_TARGET);
			})
			.catch(() => {
				if (!cancelled) setSelected(DEFAULT_TARGET);
			});
		return () => {
			cancelled = true;
		};
	}, []);

	const handleChange = (code: string) => {
		if (!KNOWN_CODES.has(code)) return;
		setSelected(code);
		void pluginConfig.set('target_currency', code).catch((e) => {
			console.error('[Steam Currency Converter] failed to save target_currency', e);
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
					// Steam's Dropdown is a class component that keeps its own
					// selection state and ignores `selectedOption` prop updates
					// after mount — remount it via `key` when the value changes.
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
	// `title` is required by the ttc runtime to register the settings panel,
	// even though the current @steambrew/client `Plugin` type omits it.
	title: 'Steam Currency Converter',
	icon: <IconsModule.Settings />,
	content: <SettingsContent />,
}));
