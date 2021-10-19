import { MessageTypes } from 'ircv3';
import { CommandHandler } from '../CommandHandler';
import type { User } from '../../User';
import type { Server } from '../../Server';

export class PingHandler extends CommandHandler<MessageTypes.Commands.Ping> {
	constructor() {
		super(MessageTypes.Commands.Ping);
	}

	handleCommand(cmd: MessageTypes.Commands.Ping, user: User, server: Server): void {
		user.ifRegistered(() => {
			const msg = server.createMessage(MessageTypes.Commands.Pong, {
				server: server.serverAddress,
				message: cmd.params.message
			});

			user.sendMessage(msg);
		});
	}
}
