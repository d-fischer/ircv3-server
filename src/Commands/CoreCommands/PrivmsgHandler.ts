import CommandHandler from '../CommandHandler';
import type { User } from '../../User';
import type { Server } from '../../Server';
import { isChannel, MessageTypes } from 'ircv3';
import { ModuleResult } from '../../Modules/Module';

export default class PrivmsgHandler extends CommandHandler<MessageTypes.Commands.PrivateMessage> {
	constructor() {
		super(MessageTypes.Commands.PrivateMessage);
	}

	handleCommand(cmd: MessageTypes.Commands.PrivateMessage, user: User, server: Server): void {
		user.ifRegistered(() => {
			// TODO multi target
			if (isChannel(cmd.params.target)) {
				const channel = server.getChannelByName(cmd.params.target);

				if (channel) {
					const result = server.callHook('channelMessage', channel, user, cmd.params.content);
					if (result !== ModuleResult.DENY) {
						channel.broadcastMessage(
							MessageTypes.Commands.PrivateMessage,
							{
								target: channel.name,
								content: cmd.params.content
							},
							user.prefix,
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
					otherUser.sendMessage(
						MessageTypes.Commands.PrivateMessage,
						{
							target: otherUser.nick,
							content: cmd.params.content
						},
						user.prefix
					);
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
