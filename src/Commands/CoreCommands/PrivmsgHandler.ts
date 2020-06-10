import CommandHandler from '../CommandHandler';
import PrivateMessage from 'ircv3/lib/Message/MessageTypes/Commands/PrivateMessage';
import User from '../../User';
import Server from '../../Server';
import { isChannel } from 'ircv3';
import { ModuleResult } from '../../Modules/Module';
import * as Numerics from 'ircv3/lib/Message/MessageTypes/Numerics';

export default class PrivmsgHandler extends CommandHandler<PrivateMessage> {
	constructor() {
		super(PrivateMessage);
	}

	handleCommand(cmd: PrivateMessage, user: User, server: Server) {
		user.ifRegistered(() => {
			// TODO multi target
			if (isChannel(cmd.params.target)) {
				const channel = server.getChannelByName(cmd.params.target);

				if (!channel) {
					user.sendNumericReply(Numerics.Error403NoSuchChannel, {
						channel: cmd.params.target,
						suffix: 'No such channel'
					});
				} else {
					const result = server.callHook('onChannelMessage', channel, user, cmd.params.message);
					if (result !== ModuleResult.DENY) {
						channel.broadcastMessage(PrivateMessage, {
							target: channel.name,
							message: cmd.params.message
						}, user.prefix, user);
					}
				}
			} else {
				const otherUser = server.getUserByNick(cmd.params.target);

				if (!otherUser) {
					user.sendNumericReply(Numerics.Error401NoSuchNick, {
						nick: cmd.params.target,
						suffix: 'No such nick'
					});
				} else {
					otherUser.sendMessage(PrivateMessage, {
						target: otherUser.nick,
						message: cmd.params.message
					}, user.prefix);
				}
			}
		});
	}
}
