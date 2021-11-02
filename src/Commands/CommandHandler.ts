import { MessageTypes } from 'ircv3';
import type { Message, MessageConstructor } from 'ircv3';
import type { SendResponseCallback } from '../SendResponseCallback';
import type { User } from '../User';
import type { Server } from '../Server';

export abstract class CommandHandler<T extends Message = Message> {
	private readonly _command: string;
	protected _requiresRegistration = true;

	constructor(type: MessageConstructor<T>) {
		this._command = type.COMMAND;
	}

	get command(): string {
		return this._command;
	}

	checkAndHandleCommand(cmd: T, user: User, server: Server, respond: SendResponseCallback): void {
		if (this._requiresRegistration && !user.isRegistered) {
			respond(
				MessageTypes.Numerics.Error451NotRegistered,
				{
					suffix: 'You have not registered'
				},
				undefined
			);
			return;
		}

		this.handleCommand(cmd, user, server, respond);
	}

	abstract handleCommand(cmd: T, user: User, server: Server, respond: SendResponseCallback): void;

	// handleParseError(user: User, server: Server) {}
}
