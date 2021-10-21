import { Module } from '../../Module';
import type { ModuleComponentHolder } from '../../ModuleComponentHolder';
import { GlobalOperModeHandler } from './GlobalOperModeHandler';
import { LocalOperModeHandler } from './LocalOperModeHandler';
import { OperLoginCommandHandler } from './OperLoginCommandHandler';

export class OperModule extends Module {
	private readonly _globalOperMode = new GlobalOperModeHandler();
	private readonly _localOperMode = new LocalOperModeHandler();

	init(components: ModuleComponentHolder): void {
		components.addMode(this._globalOperMode);
		components.addMode(this._localOperMode);
		components.addCommand(new OperLoginCommandHandler(this._globalOperMode, this._localOperMode));
	}
}
