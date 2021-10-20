import { Module } from '../../Module';
import type { ModuleComponentHolder } from '../../ModuleComponentHolder';
import { UserHostCommandHandler } from './UserHostCommandHandler';

export class UserHostModule extends Module {
	init(components: ModuleComponentHolder): void {
		components.addCommand(new UserHostCommandHandler());
	}
}
