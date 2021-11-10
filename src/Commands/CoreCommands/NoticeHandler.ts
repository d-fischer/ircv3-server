import type { SendResponseCallback } from '../../SendResponseCallback';
import { CommandHandler } from '../CommandHandler';
import type { User } from '../../User';
import type { Server } from '../../Server';
import { isChannel, MessageTypes } from 'ircv3';
import { HookResult } from '../../Modules/Module';

export class NoticeHandler extends CommandHandler<MessageTypes.Commands.Notice> {
	constructor() {
		super(MessageTypes.Commands.Notice);
	}

	handleCommand(cmd: MessageTypes.Commands.Notice, user: User, server: Server, respond: SendResponseCallback): void {
		// TODO multi target

		if (isChannel(cmd.params.target)) {
			const channel = server.getChannelByName(cmd.params.target);

			if (channel) {
				const result = server.callHook('channelNotice', channel, user, cmd.params.content, respond);
				if (result !== HookResult.DENY) {
					const clientTags = server.getRedirectableClientTags(cmd);
					channel.broadcastMessage(
						MessageTypes.Commands.Notice,
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
				otherUser.sendMessage(
					MessageTypes.Commands.Notice,
					{
						target: otherUser.nick!,
						content: cmd.params.content
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
