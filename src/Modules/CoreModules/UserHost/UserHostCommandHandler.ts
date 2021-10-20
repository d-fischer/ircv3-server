import { MessageTypes } from 'ircv3';
import { CommandHandler } from '../../../Commands/CommandHandler';
import type { Server } from '../../../Server';
import type { User } from '../../../User';

export class UserHostCommandHandler extends CommandHandler<MessageTypes.Commands.UserHostQuery> {
	constructor() {
		super(MessageTypes.Commands.UserHostQuery);
	}
	handleCommand(cmd: MessageTypes.Commands.UserHostQuery, user: User, server: Server): void {
		const nickList = cmd.params.nicks.split(' ');
		const hosts = nickList
			.filter(nick => server.nickExists(nick))
			.map(nick => {
				const queriedUser = server.getUserByNick(nick)!;
				const hostName = queriedUser === user ? queriedUser.ipAddress : queriedUser.publicHostName;
				// TODO use - for away users
				return `${nick}=+${queriedUser.prefix.user!}@${hostName}`;
			})
			.join(' ');

		user.sendNumericReply(MessageTypes.Numerics.Reply302UserHost, { hosts });
	}
}
