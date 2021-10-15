import { MessageTypes } from 'ircv3';
import CommandHandler from '../CommandHandler';
import type { User } from '../../User';

export default class UserRegistrationHandler extends CommandHandler<MessageTypes.Commands.UserRegistration> {
	constructor() {
		super(MessageTypes.Commands.UserRegistration);
	}

	handleCommand(cmd: MessageTypes.Commands.UserRegistration, user: User): void {
		if (user.isRegistered) {
			user.sendNumericReply(MessageTypes.Numerics.Error462AlreadyRegistered, {
				suffix: 'You may not reregister'
			});
		} else {
			user.setUserRegistration(cmd.params.user, cmd.params.realName);
		}
	}
}
