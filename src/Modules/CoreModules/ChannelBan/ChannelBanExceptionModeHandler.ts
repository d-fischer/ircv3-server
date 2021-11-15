import { MessageTypes } from 'ircv3';
import type { Channel } from '../../../Channel';
import { ListChannelModeHandler } from '../../../Modes/Channel/ListChannelModeHandler';
import type { SendResponseCallback } from '../../../SendResponseCallback';
import type { User } from '../../../User';

export class ChannelBanExceptionModeHandler extends ListChannelModeHandler {
	constructor() {
		super('banException', 'e', 'halfop');
	}

	sendList(channel: Channel, user: User, respond: SendResponseCallback): void {
		for (const entry of this.getList(channel)) {
			respond(MessageTypes.Numerics.Reply348ExceptList, {
				channel: channel.name,
				mask: entry.value,
				creatorName: entry.creatorName,
				timestamp: Math.floor(entry.timestamp / 1000).toString()
			});
		}
		respond(MessageTypes.Numerics.Reply349EndOfExceptList, {
			channel: channel.name,
			suffix: 'End of channel exception list'
		});
	}
}
