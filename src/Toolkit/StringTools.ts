export function sortStringByOrder(str: string, order: string): string {
	const orderForChar = Object.assign({}, ...order.split('').map((value, index) => ({ [value]: index + 1 })));
	return str.split('').sort((a, b) => (orderForChar[a] || 999) - (orderForChar[b] || 999)).join('');
}
