import { Module, HookResult } from '../../Module';
import type { ModuleComponentHolder } from '../../ModuleComponentHolder';
import { InvisibleModeHandler } from './InvisibleModeHandler';
import type { User } from '../../../User';

export class InvisibleModule extends Module {
	private readonly _invisibleMode = new InvisibleModeHandler();

	init(components: ModuleComponentHolder): void {
		components.addMode(this._invisibleMode);
		components.addHook('userCreate', this.onUserCreate);
	}

	onUserCreate = (user: User): HookResult => {
		user.addMode(this._invisibleMode);

		return HookResult.NEXT;
	};
}
