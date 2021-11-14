import type { Channel } from '../../../Channel';
import { ModeHandler } from '../../../Modes/ModeHandler';
import type { Server } from '../../../Server';
import type { User } from '../../../User';

export class ChannelLimitModeHandler extends ModeHandler {
	constructor() {
		super('limit', 'l', 'setOnly', 'channel');
	}

	checkAccess(target: Channel, user: User): boolean {
		return target.isUserAtLeast(user, 'op');
	}

	checkValidity(channel: Channel, user: User, server: Server, adding: boolean, param?: string): boolean {
		if (!adding) {
			return true;
		}

		if (param == null) {
			return false;
		}

		const paramAsNum = +param;
		if (Number.isNaN(paramAsNum)) {
			return false;
		}

		return paramAsNum > 0;
	}

	getLimit(channel: Channel): number | null {
		const limitStr = this._getCurrentParam(channel);
		if (limitStr == null) {
			return null;
		}

		return +limitStr;
	}
}
