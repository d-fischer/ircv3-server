import { Module } from '../../Module';
import type { ModuleComponentHolder } from '../../ModuleComponentHolder';
import { KillCommandHandler } from './KillCommandHandler';

export class KillModule extends Module {
	init(components: ModuleComponentHolder): void {
		components.addCommand(new KillCommandHandler());
	}
}
