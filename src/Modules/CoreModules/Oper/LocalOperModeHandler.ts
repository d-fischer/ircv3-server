import { UserModeHandler } from '../../../Modes/UserModeHandler';
import type { Server } from '../../../Server';
import type { User } from '../../../User';

export class LocalOperModeHandler extends UserModeHandler {
	constructor() {
		super('localOper', 'O');
	}

	checkAccess(target: User, user: User, server: Server, adding: boolean): boolean {
		return user === target && !adding;
	}
}
