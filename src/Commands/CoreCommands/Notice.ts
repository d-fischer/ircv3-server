import { CommandHandler } from '../CommandHandler';
import type { User } from '../../User';
import type { Server } from '../../Server';
import { isChannel, MessageTypes } from 'ircv3';
import { ModuleResult } from '../../Modules/Module';

export class NoticeHandler extends CommandHandler<MessageTypes.Commands.Notice> {
	constructor() {
		super(MessageTypes.Commands.Notice);
	}

	handleCommand(cmd: MessageTypes.Commands.Notice, user: User, server: Server): void {
		user.ifRegistered(() => {
			// TODO multi target
			if (isChannel(cmd.params.target)) {
				const channel = server.getChannelByName(cmd.params.target);

				if (channel) {
					const result = server.callHook('channelNotice', channel, user, cmd.params.content);
					if (result !== ModuleResult.DENY) {
						channel.broadcastMessage(
							server.createMessage(
								MessageTypes.Commands.Notice,
								{
									target: channel.name,
									content: cmd.params.content
								},
								user.prefix
							),
							user
						);
					}
				} else {
					user.sendNumericReply(MessageTypes.Numerics.Error403NoSuchChannel, {
						channel: cmd.params.target,
						suffix: 'No such channel'
					});
				}
			} else {
				const otherUser = server.getUserByNick(cmd.params.target);

				if (otherUser) {
					const msg = server.createMessage(
						MessageTypes.Commands.Notice,
						{
							target: otherUser.nick,
							content: cmd.params.content
						},
						user.prefix
					);

					otherUser.sendMessage(msg);
				} else {
					user.sendNumericReply(MessageTypes.Numerics.Error401NoSuchNick, {
						nick: cmd.params.target,
						suffix: 'No such nick'
					});
				}
			}
		});
	}
}
