import type { User } from '../../../User';
import type Channel from '../../../Channel';

export default class Invite {
	constructor(private readonly _user: User, private readonly _channel: Channel, private readonly _byUser: User) {}

	get user(): User {
		return this._user;
	}

	get channel(): Channel {
		return this._channel;
	}

	get inviter(): User {
		return this._byUser;
	}
}
