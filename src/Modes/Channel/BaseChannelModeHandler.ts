import type { Channel } from '../../Channel';
import type { User } from '../../User';
import type { ModeParamSpec } from '../ModeHandler';
import { ModeHandler } from '../ModeHandler';

export abstract class BaseChannelModeHandler extends ModeHandler {
	protected constructor(
		name: string,
		letter: string,
		private readonly _minAccess?: string,
		paramSpec: ModeParamSpec = 'never'
	) {
		super(name, letter, 'channel', paramSpec);
	}

	hasRequiredLevel(user: User, channel: Channel): boolean {
		if (!this._minAccess) {
			return true;
		}
		return channel.isUserAtLeast(user, this._minAccess);
	}

	checkAccess(channel: Channel, user: User): boolean {
		return this.hasRequiredLevel(user, channel);
	}
}
