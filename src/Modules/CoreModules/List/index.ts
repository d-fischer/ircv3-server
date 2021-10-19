import { Module } from '../../Module';
import type ModuleComponentHolder from '../../ModuleComponentHolder';
import ListCommandHandler from './ListCommandHandler';

export default class ListModule extends Module {
	init(components: ModuleComponentHolder): void {
		components.addCommand(new ListCommandHandler());
	}
}
