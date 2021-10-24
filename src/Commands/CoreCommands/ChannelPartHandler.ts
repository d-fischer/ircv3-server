import { CommandHandler } from '../CommandHandler';
import type { User } from '../../User';
import type { Server } from '../../Server';
import { isChannel, MessageTypes } from 'ircv3';

export class ChannelPartHandler extends CommandHandler<MessageTypes.Commands.ChannelPart> {
	constructor() {
		super(MessageTypes.Commands.ChannelPart);
	}

	handleCommand(cmd: MessageTypes.Commands.ChannelPart, user: User, server: Server): void {
		user.ifRegistered(() => {
			const channelName = cmd.params.channel;
			if (!isChannel(channelName)) {
				user.sendNumericReply(MessageTypes.Numerics.Error403NoSuchChannel, {
					channel: channelName,
					suffix: 'No such channel'
				});
				return;
			}
			server.partChannel(user, channelName, cmd.params.reason);
		});
	}
}
