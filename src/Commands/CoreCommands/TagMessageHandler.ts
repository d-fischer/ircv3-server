import type { SendResponseCallback } from '../../SendResponseCallback';
import { CommandHandler } from '../CommandHandler';
import type { User } from '../../User';
import type { Server } from '../../Server';
import { isChannel, MessageTypes } from 'ircv3';
import { ModuleResult } from '../../Modules/Module';

export class TagMessageHandler extends CommandHandler<MessageTypes.Commands.TagMessage> {
	constructor() {
		super(MessageTypes.Commands.TagMessage);
	}

	handleCommand(
		cmd: MessageTypes.Commands.TagMessage,
		user: User,
		server: Server,
		respond: SendResponseCallback
	): void {
		// TODO multi target

		if (isChannel(cmd.params.target)) {
			const channel = server.getChannelByName(cmd.params.target);

			if (channel) {
				const result = server.callHook('channelTagMessage', channel, user, respond);
				if (result !== ModuleResult.DENY) {
					const clientTags = server.getRedirectableClientTags(cmd);
					channel.broadcastMessage(
						MessageTypes.Commands.TagMessage,
						{
							target: channel.name
						},
						user.prefix,
						{
							clientTags
						},
						user
					);
				}
			} else {
				respond(MessageTypes.Numerics.Error403NoSuchChannel, {
					channel: cmd.params.target,
					suffix: 'No such channel'
				});
			}
		} else {
			const otherUser = server.getUserByNick(cmd.params.target);

			if (otherUser) {
				const clientTags = server.getRedirectableClientTags(cmd);
				otherUser.sendMessage(
					MessageTypes.Commands.TagMessage,
					{
						target: otherUser.nick!
					},
					user.prefix,
					{
						clientTags
					}
				);
			} else {
				respond(MessageTypes.Numerics.Error401NoSuchNick, {
					nick: cmd.params.target,
					suffix: 'No such nick'
				});
			}
		}
	}
}
