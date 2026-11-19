import { callable, findModuleExport } from '@steambrew/client';
import { useEffect, useState, type ReactNode } from 'react';
import { getRate, safeParseJSON } from '../shared/exchange-rates';
import { tokenToNumber } from '../shared/price-number';
import { findCurrencyById } from '../shared/steam-currencies';

interface SteamClientState {
	cm: { GetServiceTransport(): unknown };
}

interface WalletService {
	GetClientWalletDetails(transport: unknown, request: Record<string, never>): Promise<{
		BSuccess(): boolean;
		Body(): { currency_code(): number };
	}>;
}

interface WalletProps {
	original: ReactNode;
	balance?: string;
	steamId?: string;
	client: SteamClientState;
}

const getSettings = callable<[], string>('get_settings');
const pendingConversions = new Map<string, Promise<string | null>>();

async function convertBalance(client: SteamClientState, balance: string): Promise<string | null> {
	const service = findModuleExport(
		(value) => typeof value?.GetClientWalletDetails === 'function',
	) as WalletService | undefined;
	if (!service) return null;

	const [settingsJson, wallet] = await Promise.all([
		getSettings(),
		service.GetClientWalletDetails(client.cm.GetServiceTransport(), {}),
	]);
	if (!wallet.BSuccess()) return null;
	const currency = findCurrencyById(wallet.Body().currency_code())?.abbr;
	const settings = safeParseJSON<{ target_currency?: string; rate_source?: string }>(settingsJson);
	const target = settings?.target_currency ?? 'RUB';
	if (!currency || currency === target) return null;

	const decimals = new Intl.NumberFormat(undefined, { style: 'currency', currency })
		.resolvedOptions().maximumFractionDigits;
	const token = balance.match(/\d[\d.,\s]*\d|\d/g);
	const amount = token?.length === 1 ? tokenToNumber(token[0], decimals) : null;
	if (amount === null) return null;

	const format = new Intl.NumberFormat(undefined, { style: 'currency', currency: target, currencyDisplay: 'code' });
	const converted = amount === 0 ? 0 : amount / await getRate(target, currency, settings?.rate_source === 'freedom_bank');
	return Number.isFinite(converted) ? format.format(converted) : null;
}

export function WalletBalance({ original, balance, steamId, client }: WalletProps) {
	const key = steamId && balance ? JSON.stringify([steamId, balance]) : '';
	const [hint, setHint] = useState<{ key: string; text: string } | null>(null);

	useEffect(() => {
		setHint(null);
		if (!key || !balance) return;
		let cancelled = false;
		let conversion = pendingConversions.get(key);
		if (!conversion) {
			conversion = convertBalance(client, balance)
				.catch((error: unknown) => {
					console.debug('[Steam Currency Converter] wallet conversion failed', error);
					return null;
				})
				.finally(() => pendingConversions.delete(key));
			pendingConversions.set(key, conversion);
		}
		void conversion.then((text) => {
			if (!cancelled && text !== null) setHint({ key, text });
		});
		return () => {
			cancelled = true;
		};
	}, [key, balance, client]);

	return <>{original}{hint?.key === key && <span style={{ whiteSpace: 'nowrap' }}>{' (≈ '}{hint.text}{')'}</span>}</>;
}
