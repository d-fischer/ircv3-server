import type { Message, MessageConstructor } from 'ircv3';
import type { User } from '../User';
import type { Server } from '../Server';

export abstract class CommandHandler<T extends Message = Message> {
	private readonly _command: string;

	constructor(type: MessageConstructor<T>) {
		this._command = type.COMMAND;
	}

	get command(): string {
		return this._command;
	}

	abstract handleCommand(cmd: T, user: User, server: Server): void;
	// handleParseError(user: User, server: Server) {}
}
