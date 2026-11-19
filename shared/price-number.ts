/** Turn one number-like token ("1,234.56" / "1.234,56" / "1 199") into a number. */
export function tokenToNumber(token: string, decimalPlaces = 2): number | null {
	let s = token.replace(/[^\d.,]/g, '');
	if (!/\d/.test(s)) return null;

	const lastComma = s.lastIndexOf(',');
	const lastDot = s.lastIndexOf('.');
	let decSep: ',' | '.' | null = null;

	if (lastComma > -1 && lastDot > -1) {
		decSep = lastComma > lastDot ? ',' : '.';
	} else if (lastComma > -1) {
		const digitsAfter = s.length - lastComma - 1;
		if (s.indexOf(',') === lastComma && (digitsAfter >= 1 && digitsAfter <= decimalPlaces)) decSep = ',';
	} else if (lastDot > -1) {
		const digitsAfter = s.length - lastDot - 1;
		if (s.indexOf('.') === lastDot && (digitsAfter >= 1 && digitsAfter <= decimalPlaces)) decSep = '.';
	}

	if (decSep) {
		const thouSep = decSep === ',' ? '.' : ',';
		s = s.split(thouSep).join('').replace(decSep, '.');
	} else {
		s = s.replace(/[.,]/g, '');
	}

	const value = Number(s);
	return Number.isFinite(value) && value >= 0 ? value : null;
}
