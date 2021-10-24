import { MessageTypes } from 'ircv3';
import { CommandHandler } from '../../../Commands/CommandHandler';
import type { Server } from '../../../Server';
import type { User } from '../../../User';

export class KillCommandHandler extends CommandHandler<MessageTypes.Commands.Kill> {
	constructor() {
		super(MessageTypes.Commands.Kill);
	}

	handleCommand(cmd: MessageTypes.Commands.Kill, user: User, server: Server): void {
		if (!user.hasMode('globalOper') && !user.hasMode('localOper')) {
			user.sendNumericReply(MessageTypes.Numerics.Error481NoPrivileges, {
				suffix: "Permission denied - You're not an IRC operator"
			});
			return;
		}

		const userToKill = server.getUserByNick(cmd.params.target);

		if (!userToKill) {
			user.sendNumericReply(MessageTypes.Numerics.Error401NoSuchNick, {
				nick: cmd.params.target,
				suffix: 'No such nick'
			});
			return;
		}

		server.killUser(userToKill, cmd.params.reason, user.connectionIdentifier);
	}
}
