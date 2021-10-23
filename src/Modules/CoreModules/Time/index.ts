import { Module } from '../../Module';
import type { ModuleComponentHolder } from '../../ModuleComponentHolder';
import { TimeCommandHandler } from './TimeCommandHandler';

export class TimeModule extends Module {
	init(components: ModuleComponentHolder): void {
		components.addCommand(new TimeCommandHandler());
	}
}
