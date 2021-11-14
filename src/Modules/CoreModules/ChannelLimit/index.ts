import { MessageTypes } from 'ircv3';
import type { Channel } from '../../../Channel';
import type { SendResponseCallback } from '../../../SendResponseCallback';
import type { User } from '../../../User';
import { HookResult, Module } from '../../Module';
import type { ModuleComponentHolder } from '../../ModuleComponentHolder';
import { ChannelLimitModeHandler } from './ChannelLimitModeHandler';

export class ChannelLimitModule extends Module {
	private readonly _channelLimitModeHandler = new ChannelLimitModeHandler();

	init(components: ModuleComponentHolder): void {
		components.addMode(this._channelLimitModeHandler);
		components.addHook('channelJoin', this.onChannelJoin);
	}

	onChannelJoin = (
		channel: Channel,
		user: User,
		cmd: MessageTypes.Commands.ChannelJoin,
		respond: SendResponseCallback
	): HookResult => {
		const limit = this._channelLimitModeHandler.getLimit(channel);

		if (limit != null && channel.numberOfUsers >= limit) {
			respond(MessageTypes.Numerics.Error471ChannelIsFull, {
				channel: channel.name,
				suffix: 'Cannot join channel (+l)'
			});
			return HookResult.DENY;
		}

		return HookResult.NEXT;
	};
}
