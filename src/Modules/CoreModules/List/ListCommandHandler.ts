import { MessageTypes } from 'ircv3';
import CommandHandler from '../../../Commands/CommandHandler';
import type { Server } from '../../../Server';
import type { User } from '../../../User';

export default class ListCommandHandler extends CommandHandler<MessageTypes.Commands.ChannelList> {
	constructor() {
		super(MessageTypes.Commands.ChannelList);
	}
	handleCommand(cmd: MessageTypes.Commands.ChannelList, user: User, server: Server): void {
		// TODO implement some ELIST tokens
		let channels = server.channels;
		if (cmd.params.channel) {
			const channelList = cmd.params.channel.split(',');
			channels = new Map([...channels].filter(([name]) => channelList.includes(name)));
		}
		for (const [, channel] of channels) {
			user.sendNumericReply(MessageTypes.Numerics.Reply322List, {
				channel: channel.name,
				memberCount: channel.users.size.toString(),
				topic: channel.topic
			});
		}
		user.sendNumericReply(MessageTypes.Numerics.Reply323ListEnd, {
			suffix: 'End of LIST'
		});
	}
}
