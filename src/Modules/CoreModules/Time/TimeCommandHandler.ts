import { MessageTypes } from 'ircv3';
import { CommandHandler } from '../../../Commands/CommandHandler';
import type { Server } from '../../../Server';
import type { User } from '../../../User';

export class TimeCommandHandler extends CommandHandler<MessageTypes.Commands.Time> {
	constructor() {
		super(MessageTypes.Commands.Time);
	}

	handleCommand(cmd: MessageTypes.Commands.Time, user: User, server: Server): void {
		// TODO remote server?

		const now = new Date();

		user.sendNumericReply(MessageTypes.Numerics.Reply391Time, {
			server: server.serverAddress,
			timestamp: now.toISOString()
		});
	}
}
