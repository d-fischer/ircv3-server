import SimpleModeHandler from './SimpleModeHandler';
import type { User } from '../User';
import type Channel from '../Channel';

export default class SimpleChannelModeHandler extends SimpleModeHandler {
	constructor(name: string, letter: string, private readonly _minAccess?: string) {
		super(name, letter, 'channel');
	}

	hasRequiredLevel(user: User, channel: Channel): boolean {
		if (!this._minAccess) {
			return true;
		}
		return channel.isUserAtLeast(user, this._minAccess);
	}

	canSetOn(channel: Channel, user: User): boolean {
		return this.hasRequiredLevel(user, channel);
	}
}
