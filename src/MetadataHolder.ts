import { type Server } from './Server';

export type MetadataType = 'channel';

export abstract class MetadataHolder<T> {
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
	private _metadata = {} as T;

	constructor(protected readonly _server: Server, private readonly _metadataType: MetadataType) {}

	getMetadata<K extends Extract<keyof T, string>>(key: K): T[K] {
		return this._metadata[key];
	}

	defaultMetadata(values: Partial<T>): void {
		Object.assign(this._metadata, values);
	}

	putMetadata<K extends Extract<keyof T, string>>(key: K, value: T[K]): void {
		this._metadata[key] = value;
		this._server.callHook('metadataChange', this._metadataType, this, key, value, this._server);
	}
}
