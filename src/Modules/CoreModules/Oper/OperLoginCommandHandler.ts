import { MessageTypes } from 'ircv3';
import type { Server } from '../../../Server';
import type { User } from '../../../User';
import { CommandHandler } from '../../../Commands/CommandHandler';
import type { GlobalOperModeHandler } from './GlobalOperModeHandler';
import type { LocalOperModeHandler } from './LocalOperModeHandler';

export class OperLoginCommandHandler extends CommandHandler<MessageTypes.Commands.OperLogin> {
	constructor(
		private readonly _globalOperMode: GlobalOperModeHandler,
		private readonly _localOperMode: LocalOperModeHandler
	) {
		super(MessageTypes.Commands.OperLogin);
	}

	handleCommand(cmd: MessageTypes.Commands.OperLogin, user: User, server: Server): void {
		const resultingLogin = server.loginAsOper(cmd.params.name, cmd.params.password);
		if (resultingLogin) {
			user.sendNumericReply(MessageTypes.Numerics.Reply381YoureOper, {
				suffix: 'You are now an IRC operator'
			});
			user.giveMode(resultingLogin.global ? this._globalOperMode : this._localOperMode);
		} else {
			user.sendNumericReply(MessageTypes.Numerics.Error491NoOperHost, {
				suffix: 'No appropriate operator blocks were found for your host'
			});
		}
	}
}
