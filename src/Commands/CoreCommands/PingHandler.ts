import CommandHandler from '../CommandHandler';
import Ping from 'ircv3/lib/Message/MessageTypes/Commands/Ping';
import Pong from 'ircv3/lib/Message/MessageTypes/Commands/Pong';
import User from '../../User';
import Server from '../../Server';

export default class PingHandler extends CommandHandler<Ping> {
	constructor() {
		super(Ping);
	}

	handleCommand(cmd: Ping, user: User, server: Server) {
		user.ifRegistered(() => user.sendMessage(Pong, {
			server: server.serverAddress,
			message: cmd.params.message
		}));
	}
}
