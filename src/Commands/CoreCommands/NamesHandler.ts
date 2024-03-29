import { MessageTypes } from 'ircv3';
import type { SendResponseCallback } from '../../SendResponseCallback';
import { CommandHandler } from '../CommandHandler';
import type { User } from '../../User';
import type { Server } from '../../Server';

export class NamesHandler extends CommandHandler<MessageTypes.Commands.Names> {
	constructor() {
		super(MessageTypes.Commands.Names);
	}

	handleCommand(cmd: MessageTypes.Commands.Names, user: User, server: Server, respond: SendResponseCallback): void {
		// RFC allows to only process the first channel
		const channelNames = cmd.params.channel?.split(',');

		if (channelNames?.length) {
			const channel = server.getChannelByName(channelNames[0]);

			if (channel) {
				channel.sendNames(user, respond);
				return;
			}
		} else {
			// TODO global user list? it doesn't seem to be widely implemented
		}
		respond(MessageTypes.Numerics.Reply366EndOfNames, {
			channel: channelNames?.[0] ?? '*',
			suffix: 'End of /NAMES list'
		});
	}
}
