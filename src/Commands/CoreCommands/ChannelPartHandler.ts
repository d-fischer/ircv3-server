import CommandHandler from '../CommandHandler';
import ChannelPart from 'ircv3/lib/Message/MessageTypes/Commands/ChannelPart';
import User from '../../User';
import Server from '../../Server';
import { isChannel } from 'ircv3';
import * as Numerics from 'ircv3/lib/Message/MessageTypes/Numerics';

export default class ChannelPartHandler extends CommandHandler<ChannelPart> {
	constructor() {
		super(ChannelPart);
	}

	handleCommand(cmd: ChannelPart, user: User, server: Server) {
		user.ifRegistered(() => {
			const channelName = cmd.params.channel;
			if (!isChannel(channelName)) {
				user.sendNumericReply(Numerics.Error403NoSuchChannel, {
					channel: channelName,
					suffix: 'No such channel'
				});
				return;
			}
			server.partChannel(user, channelName);
		});
	}
}
