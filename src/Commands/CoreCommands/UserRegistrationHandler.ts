import CommandHandler from '../CommandHandler';
import UserRegistration from 'ircv3/lib/Message/MessageTypes/Commands/UserRegistration';
import User from '../../User';
import * as Numerics from 'ircv3/lib/Message/MessageTypes/Numerics';

export default class UserRegistrationHandler extends CommandHandler<UserRegistration> {
	constructor() {
		super(UserRegistration);
	}

	handleCommand(cmd: UserRegistration, user: User) {
		if (user.isRegistered) {
			user.sendNumericReply(Numerics.Error462AlreadyRegistered, {
				suffix: 'You may not reregister'
			});
		} else {
			user.setUserRegistration(cmd.params.user, cmd.params.realName);
		}
	}
}
