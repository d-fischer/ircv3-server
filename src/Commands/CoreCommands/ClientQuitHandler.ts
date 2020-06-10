import CommandHandler from '../CommandHandler';
import ClientQuit from 'ircv3/lib/Message/MessageTypes/Commands/ClientQuit';
import User from '../../User';
import Server from '../../Server';

export default class ClientQuitHandler extends CommandHandler<ClientQuit> {
	constructor() {
		super(ClientQuit);
	}

	handleCommand(cmd: ClientQuit, user: User, server: Server) {
		server.destroyConnection(user);
	}
}
