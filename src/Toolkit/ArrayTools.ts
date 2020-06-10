export function partition<T>(arr: T[], predicate: (val: T) => boolean): [T[], T[]] {
	const result: [T[], T[]] = [[], []];
	for (const entry of arr) {
		result[+predicate(entry)].push(entry);
	}
	return result;
}
