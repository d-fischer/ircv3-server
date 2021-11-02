import { isChannel, MessageTypes } from 'ircv3';
import type { SendResponseCallback } from '../../SendResponseCallback';
import type { Server } from '../../Server';
import type { User } from '../../User';
import { CommandHandler } from '../CommandHandler';

export class ChannelJoinHandler extends CommandHandler<MessageTypes.Commands.ChannelJoin> {
	constructor() {
		super(MessageTypes.Commands.ChannelJoin);
	}

	handleCommand(
		cmd: MessageTypes.Commands.ChannelJoin,
		user: User,
		server: Server,
		respond: SendResponseCallback
	): void {
		const channelName = cmd.params.channel;
		if (!isChannel(channelName)) {
			respond(MessageTypes.Numerics.Error403NoSuchChannel, {
				channel: channelName,
				suffix: 'No such channel'
			});
			return;
		}
		server.joinChannel(user, channelName, respond);
	}
}
