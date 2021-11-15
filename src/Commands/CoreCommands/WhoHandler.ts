import { MessageTypes } from 'ircv3';
import type { Channel } from '../../Channel';
import type { SendResponseCallback } from '../../SendResponseCallback';
import type { Server } from '../../Server';
import type { User } from '../../User';
import { CommandHandler } from '../CommandHandler';

export class WhoHandler extends CommandHandler<MessageTypes.Commands.WhoQuery> {
	constructor() {
		super(MessageTypes.Commands.WhoQuery);
	}

	handleCommand(
		cmd: MessageTypes.Commands.WhoQuery,
		user: User,
		server: Server,
		respond: SendResponseCallback
	): void {
		const hasOperFlag = cmd.params.flags?.includes('o') ?? false;

		let foundChannel: Channel | null = null;
		const passedMask = cmd.params.mask;
		let searchMask: string | null = null;
		if (passedMask !== '0' && passedMask !== '*') {
			searchMask = passedMask;
			foundChannel = server.getChannelByName(passedMask);
		}

		let foundUsers = foundChannel
			? [...foundChannel.users]
			: [...server.users].filter(
					u =>
						u.isRegistered && (searchMask === null || server.identifierMatchesWildcard(u.nick!, searchMask))
			  );

		if (hasOperFlag) {
			foundUsers = foundUsers.filter(u => u.isOper());
		}

		foundUsers = foundUsers.filter(u => u.isVisibleFor(user));

		for (const foundUser of foundUsers) {
			let flags = foundUser.isAway ? 'G' : 'H';
			if (foundUser.isOper()) {
				flags += '*';
			}
			if (foundChannel) {
				flags += foundChannel.getFilteredPrefixesForUser(foundUser, 'ov');
			}
			respond(MessageTypes.Numerics.Reply352WhoReply, {
				channel: foundChannel?.name ?? '*',
				user: foundUser.userName!,
				host: foundUser.publicHostNameAsParam,
				server: server.serverAddress,
				nick: foundUser.nick!,
				flags,
				hopsAndRealName: `0 ${foundUser.realName!}`
			});
		}

		respond(MessageTypes.Numerics.Reply315EndOfWho, {
			query: cmd.params.mask,
			suffix: 'End of /WHO list'
		});
	}
}
