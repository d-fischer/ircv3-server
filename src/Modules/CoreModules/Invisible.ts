import { UserModeHandler } from '../../Modes/UserModeHandler';
import type { User } from '../../User';
import { HookResult, Module } from '../Module';
import type { ModuleComponentHolder } from '../ModuleComponentHolder';

export class InvisibleModule extends Module {
	private readonly _invisibleMode = new UserModeHandler('invisible', 'i');

	init(components: ModuleComponentHolder): void {
		components.addMode(this._invisibleMode);
		components.addHook('userCreate', this.onUserCreate);
	}

	onUserCreate = (user: User): HookResult => {
		user.addMode(this._invisibleMode);

		return HookResult.NEXT;
	};
}
