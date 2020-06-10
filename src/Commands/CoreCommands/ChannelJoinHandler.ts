import CommandHandler from '../CommandHandler';
import ChannelJoin from 'ircv3/lib/Message/MessageTypes/Commands/ChannelJoin';
import User from '../../User';
import Server from '../../Server';
import { isChannel } from 'ircv3';
import * as Numerics from 'ircv3/lib/Message/MessageTypes/Numerics';

export default class ChannelJoinHandler extends CommandHandler<ChannelJoin> {
	constructor() {
		super(ChannelJoin);
	}

	handleCommand(cmd: ChannelJoin, user: User, server: Server) {
		user.ifRegistered(() => {
			const channelName = cmd.params.channel;
			if (!isChannel(channelName)) {
				user.sendNumericReply(Numerics.Error403NoSuchChannel, {
					channel: channelName,
					suffix: 'No such channel'
				});
				return;
			}
			server.joinChannel(user, channelName);
		});
	}
}
