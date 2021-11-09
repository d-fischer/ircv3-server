import { isChannel, MessageTypes } from 'ircv3';
import { ModuleResult } from '../../Modules/Module';
import type { SendResponseCallback } from '../../SendResponseCallback';
import type { Server } from '../../Server';
import type { User } from '../../User';
import { CommandHandler } from '../CommandHandler';

export class PrivmsgHandler extends CommandHandler<MessageTypes.Commands.PrivateMessage> {
	constructor() {
		super(MessageTypes.Commands.PrivateMessage);
	}

	handleCommand(
		cmd: MessageTypes.Commands.PrivateMessage,
		user: User,
		server: Server,
		respond: SendResponseCallback
	): void {
		// TODO multi target
		if (isChannel(cmd.params.target)) {
			const channel = server.getChannelByName(cmd.params.target);

			if (channel) {
				const result = server.callHook('channelMessage', channel, user, cmd.params.content, respond);
				if (result !== ModuleResult.DENY) {
					const clientTags = server.getRedirectableClientTags(cmd);
					channel.broadcastMessage(
						MessageTypes.Commands.PrivateMessage,
						{
							target: channel.name,
							content: cmd.params.content
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

			if (otherUser?.isRegistered) {
				const clientTags = server.getRedirectableClientTags(cmd);
				const nick = otherUser.nick!;
				otherUser.sendMessage(
					MessageTypes.Commands.PrivateMessage,
					{
						target: nick,
						content: cmd.params.content
					},
					user.prefix,
					{
						clientTags
					}
				);

				if (otherUser.isAway) {
					respond(MessageTypes.Numerics.Reply301Away, {
						nick,
						content: otherUser.awayMessage!
					});
				}
			} else {
				respond(MessageTypes.Numerics.Error401NoSuchNick, {
					nick: cmd.params.target,
					suffix: 'No such nick'
				});
			}
		}
	}
}
