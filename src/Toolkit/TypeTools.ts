export function assertNever(value: never): never {
	throw new Error(`Unhandled value: ${JSON.stringify(value)}`);
}

export type Omit<T extends object, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

// tslint:disable-next-line:no-any
export type ArgumentTypes<F extends Function> = F extends (...args: infer A) => any ? A : never;
