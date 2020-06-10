import CommandHandler from '../CommandHandler';
import Names from 'ircv3/lib/Message/MessageTypes/Commands/Names';
import User from '../../User';
import Server from '../../Server';
import * as Numerics from 'ircv3/lib/Message/MessageTypes/Numerics';

export default class NamesHandler extends CommandHandler<Names> {
	constructor() {
		super(Names);
	}

	handleCommand(cmd: Names, user: User, server: Server) {
		user.ifRegistered(() => {
			// RFC allows to only process the first channel
			const [channelName] = cmd.params.channel.split(',');

			if (channelName) {
				const channel = server.getChannelByName(channelName);

				if (channel) {
					channel.sendNames(user);
					return;
				}
			} else {
				// TODO global user list? it doesn't seem to be widely implemented
			}
			user.sendNumericReply(Numerics.Reply366EndOfNames, {
				channel: channelName || '*',
				suffix: 'End of /NAMES list'
			});
		});
	}
}
