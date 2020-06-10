import User from '../../../User';
import Channel from '../../../Channel';

export default class Invite {
	constructor(private readonly _user: User, private readonly _channel: Channel, private readonly _byUser: User) {
	}

	get user() {
		return this._user;
	}

	get channel() {
		return this._channel;
	}

	get inviter() {
		return this._byUser;
	}
}
