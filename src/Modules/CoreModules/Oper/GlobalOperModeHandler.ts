import type { Channel } from '../../../Channel';
import { SimpleModeHandler } from '../../../Modes/SimpleModeHandler';
import type { Server } from '../../../Server';
import type { User } from '../../../User';

export class GlobalOperModeHandler extends SimpleModeHandler {
	constructor() {
		super('globalOper', 'o', 'user');
	}

	canSetOn(channel: Channel, user: User, server: Server, adding: boolean): boolean {
		return !adding;
	}
}
