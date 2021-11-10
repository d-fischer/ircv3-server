import escapeStringRegexp from '@d-fischer/escape-string-regexp';

export function sortStringByOrder(str: string, order: string): string {
	const orderForChar = Object.assign(
		{},
		...order.split('').map((value, index) => ({ [value]: index + 1 }))
	) as Record<string, number>;
	return str
		.split('')
		.sort((a, b) => (orderForChar[a] || 999) - (orderForChar[b] || 999))
		.join('');
}

export function joinChunks(tokens: string[], limit: number): string[] {
	let currentLine = '';
	const lines = [];
	for (const token of tokens) {
		if (token.length > limit) {
			console.warn(`Token too long: ${token} (max length ${limit}, actual ${token.length})`);
		} else if (currentLine.length + token.length + 1 > limit) {
			lines.push(currentLine);
			currentLine = token;
		} else {
			if (currentLine.length) {
				currentLine += ' ';
			}
			currentLine += token;
		}
	}
	if (currentLine) {
		lines.push(currentLine);
	}

	return lines;
}

export function matchesWildcard(str: string, wildcard: string): boolean {
	if (!wildcard.includes('*')) {
		return str === wildcard;
	}
	return new RegExp(`^${wildcard.split('*').map(escapeStringRegexp).join('.*')}`).test(str);
}
