import { MessageTypes } from 'ircv3';
import type { SendResponseCallback } from '../../SendResponseCallback';
import { CommandHandler } from '../CommandHandler';
import type { User } from '../../User';
import type { Server } from '../../Server';

export class PingHandler extends CommandHandler<MessageTypes.Commands.Ping> {
	constructor() {
		super(MessageTypes.Commands.Ping);
		this._requiresRegistration = false;
	}

	handleCommand(cmd: MessageTypes.Commands.Ping, user: User, server: Server, respond: SendResponseCallback): void {
		respond(MessageTypes.Commands.Pong, {
			server: server.serverAddress,
			message: cmd.params.message
		});
	}
}
