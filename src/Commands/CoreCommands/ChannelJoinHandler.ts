import { isChannel, MessageTypes } from 'ircv3';
import type { Server } from '../../Server';
import type { User } from '../../User';
import CommandHandler from '../CommandHandler';

export default class ChannelJoinHandler extends CommandHandler<MessageTypes.Commands.ChannelJoin> {
	constructor() {
		super(MessageTypes.Commands.ChannelJoin);
	}

	handleCommand(cmd: MessageTypes.Commands.ChannelJoin, user: User, server: Server): void {
		user.ifRegistered(() => {
			const channelName = cmd.params.channel;
			if (!isChannel(channelName)) {
				user.sendNumericReply(MessageTypes.Numerics.Error403NoSuchChannel, {
					channel: channelName,
					suffix: 'No such channel'
				});
				return;
			}
			server.joinChannel(user, channelName);
		});
	}
}
