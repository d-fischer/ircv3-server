import { MessageTypes } from 'ircv3';
import type { Server } from '../../Server';
import { CommandHandler } from '../CommandHandler';
import type { User } from '../../User';

export class UserRegistrationHandler extends CommandHandler<MessageTypes.Commands.UserRegistration> {
	constructor() {
		super(MessageTypes.Commands.UserRegistration);
	}

	handleCommand(cmd: MessageTypes.Commands.UserRegistration, user: User, server: Server): void {
		if (user.isRegistered) {
			user.sendNumericReply(MessageTypes.Numerics.Error462AlreadyRegistered, {
				suffix: 'You may not reregister'
			});
		} else {
			user.setUserRegistration(cmd.params.user.slice(0, server.userLength), cmd.params.realName);
		}
	}
}
