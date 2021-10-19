import type { Server } from '../Server';
import { ModuleComponentHolder } from './ModuleComponentHolder';

export enum ModuleResult {
	ALLOW,
	DENY,
	NEXT
}

export abstract class Module {
	private _componentHolder?: ModuleComponentHolder;

	load(server: Server): void {
		this._componentHolder = new ModuleComponentHolder(this, server);
		this.init(this._componentHolder);
	}

	abstract init(components: ModuleComponentHolder): void;

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	unload(server: Server): void {
		if (!this._componentHolder) {
			throw new Error('Trying to unload module that was not loaded');
		}
		this._componentHolder.removeAll();
		this._componentHolder = undefined;
	}
}
