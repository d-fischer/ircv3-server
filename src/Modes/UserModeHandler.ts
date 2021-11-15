import type { Server } from '../Server';
import type { User } from '../User';
import { ModeHandler } from './ModeHandler';
import type { ModeHolder } from './ModeHolder';

export class UserModeHandler extends ModeHandler {
	constructor(name: string, letter: string) {
		super(name, letter, 'user', 'never');
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	checkAccess(target: ModeHolder, user: User, server: Server, adding: boolean, param?: string): boolean {
		return user === target;
	}
}
