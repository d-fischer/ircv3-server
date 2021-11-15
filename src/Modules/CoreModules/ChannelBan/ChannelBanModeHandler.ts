import { MessageTypes } from 'ircv3';
import type { Channel } from '../../../Channel';
import { ListChannelModeHandler } from '../../../Modes/Channel/ListChannelModeHandler';
import type { SendResponseCallback } from '../../../SendResponseCallback';
import type { User } from '../../../User';

export class ChannelBanModeHandler extends ListChannelModeHandler {
	constructor() {
		super('ban', 'b', 'halfop');
	}

	sendList(channel: Channel, user: User, respond: SendResponseCallback): void {
		for (const entry of this.getList(channel)) {
			respond(MessageTypes.Numerics.Reply367BanList, {
				channel: channel.name,
				mask: entry.value,
				creatorName: entry.creatorName,
				timestamp: Math.floor(entry.timestamp / 1000).toString()
			});
		}
		respond(MessageTypes.Numerics.Reply368EndOfBanList, {
			channel: channel.name,
			suffix: 'End of channel ban list'
		});
	}
}
