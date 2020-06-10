import Module, { ModuleResult } from '../../Module';
import ModuleComponentHolder from '../../ModuleComponentHolder';
import InvisibleModeHandler from './InvisibleModeHandler';
import User from '../../../User';

export default class InvisibleModule extends Module {
	private readonly _invisibleMode = new InvisibleModeHandler();

	init(components: ModuleComponentHolder) {
		components.addMode(this._invisibleMode);
	}

	onUserCreate(user: User) {
		user.addMode(this._invisibleMode);

		return ModuleResult.NEXT;
	}
}
