import type { Channel } from '../../../Channel';
import { ModeHandler } from '../../../Modes/ModeHandler';
import type { Server } from '../../../Server';
import type { User } from '../../../User';

export class ChannelKeyModeHandler extends ModeHandler {
	constructor() {
		super('key', 'k', 'always', 'channel');
	}

	checkAccess(target: Channel, user: User): boolean {
		return target.isUserAtLeast(user, 'op');
	}

	checkValidity(channel: Channel, user: User, server: Server, adding: boolean, param?: string): boolean {
		return adding || this._getCurrentParam(channel) === param;
	}

	keyIs(channel: Channel, keyToCheck: string | undefined): boolean {
		const currentKey = this._getCurrentParam(channel);
		console.log({ currentKey, keyToCheck });
		return !currentKey || currentKey === keyToCheck;
	}
}
