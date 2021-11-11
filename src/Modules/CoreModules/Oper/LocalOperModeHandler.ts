import type { Channel } from '../../../Channel';
import { SimpleModeHandler } from '../../../Modes/SimpleModeHandler';
import type { Server } from '../../../Server';
import type { User } from '../../../User';

export class LocalOperModeHandler extends SimpleModeHandler {
	constructor() {
		super('localOper', 'O', 'user');
	}

	checkAccess(channel: Channel, user: User, server: Server, adding: boolean): boolean {
		return !adding;
	}
}
