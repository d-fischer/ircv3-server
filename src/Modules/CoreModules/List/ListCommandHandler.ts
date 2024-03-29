import { MessageTypes } from 'ircv3';
import { CommandHandler } from '../../../Commands/CommandHandler';
import type { SendResponseCallback } from '../../../SendResponseCallback';
import type { Server } from '../../../Server';
import type { User } from '../../../User';
import type { ChannelVisibilityResult } from '../../ModuleHook';

export class ListCommandHandler extends CommandHandler<MessageTypes.Commands.ChannelList> {
	constructor() {
		super(MessageTypes.Commands.ChannelList);
	}

	handleCommand(
		cmd: MessageTypes.Commands.ChannelList,
		user: User,
		server: Server,
		respond: SendResponseCallback
	): void {
		// TODO implement some ELIST tokens
		let channels = server.channels;
		if (cmd.params.channel) {
			const channelList = cmd.params.channel.split(',');
			channels = new Map([...channels].filter(([name]) => channelList.includes(name)));
		}
		for (const [, channel] of channels) {
			let visible = false;
			if (channel.containsUser(user)) {
				visible = true;
			} else {
				const visibility: ChannelVisibilityResult = {
					secret: false
				};

				server.callHook('channelCheckVisibility', channel, user, visibility);

				if (!visibility.secret) {
					visible = true;
				}
			}

			if (visible) {
				respond(MessageTypes.Numerics.Reply322List, {
					channel: channel.name,
					memberCount: channel.users.size.toString(),
					topic: channel.topic
				});
			}
		}
		respond(MessageTypes.Numerics.Reply323ListEnd, {
			suffix: 'End of LIST'
		});
	}
}
