import { Message, MessageConstructor } from 'ircv3';
import User from '../User';
import Server from '../Server';

export default abstract class CommandHandler<T extends Message = Message> {
	private readonly _command: string;

	constructor(type: MessageConstructor<T>) {
		this._command = type.COMMAND;
	}

	get command() {
		return this._command;
	}

	abstract handleCommand(cmd: T, user: User, server: Server): void;
	// tslint:disable-next-line:no-empty
	handleParseError(user: User, server: Server) {}
}
