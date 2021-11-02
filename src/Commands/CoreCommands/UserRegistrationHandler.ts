import { MessageTypes } from 'ircv3';
import type { Server } from '../../Server';
import { CommandHandler } from '../CommandHandler';
import type { User } from '../../User';

export class UserRegistrationHandler extends CommandHandler<MessageTypes.Commands.UserRegistration> {
	constructor() {
		super(MessageTypes.Commands.UserRegistration);
		this._requiresRegistration = false;
	}

	handleCommand(cmd: MessageTypes.Commands.UserRegistration, user: User, server: Server): void {
		if (user.isRegistered) {
			user.sendMessage(
				MessageTypes.Numerics.Error462AlreadyRegistered,
				{
					me: user.connectionIdentifier,
					suffix: 'You may not reregister'
				},
				undefined,
				{
					repliesToLabel: cmd.tags.get('label')
				}
			);
		} else {
			user.setUserRegistration(cmd.params.user.slice(0, server.userLength), cmd.params.realName);
		}
	}
}
