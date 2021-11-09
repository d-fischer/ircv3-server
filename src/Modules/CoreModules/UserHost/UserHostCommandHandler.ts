import { MessageTypes } from 'ircv3';
import { CommandHandler } from '../../../Commands/CommandHandler';
import type { SendResponseCallback } from '../../../SendResponseCallback';
import type { Server } from '../../../Server';
import type { User } from '../../../User';

export class UserHostCommandHandler extends CommandHandler<MessageTypes.Commands.UserHostQuery> {
	constructor() {
		super(MessageTypes.Commands.UserHostQuery);
	}
	handleCommand(
		cmd: MessageTypes.Commands.UserHostQuery,
		user: User,
		server: Server,
		respond: SendResponseCallback
	): void {
		const nickList = cmd.params.nicks.split(' ');
		const hosts = nickList
			.filter(nick => server.nickExists(nick))
			.map(nick => server.getUserByNick(nick))
			.filter((queriedUser): queriedUser is User => queriedUser?.isRegistered ?? false)
			.map(queriedUser => {
				const hostName = queriedUser === user ? queriedUser.ipAddress : queriedUser.publicHostName;
				return `${queriedUser.nick!}=${queriedUser.isAway ? '-' : '+'}${queriedUser.prefix.user!}@${hostName}`;
			})
			.join(' ');

		respond(MessageTypes.Numerics.Reply302UserHost, { hosts });
	}
}
