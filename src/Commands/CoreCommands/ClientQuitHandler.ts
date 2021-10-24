import { MessageTypes } from 'ircv3';
import { CommandHandler } from '../CommandHandler';
import type { User } from '../../User';
import type { Server } from '../../Server';

export class ClientQuitHandler extends CommandHandler<MessageTypes.Commands.ClientQuit> {
	constructor() {
		super(MessageTypes.Commands.ClientQuit);
	}

	handleCommand(cmd: MessageTypes.Commands.ClientQuit, user: User, server: Server): void {
		server.quitUser(user, cmd.params.message ? `Quit: ${cmd.params.message}` : 'Client Quit');
	}
}
