import { MessageTypes } from 'ircv3';
import type { Channel } from '../../../Channel';
import type { SendResponseCallback } from '../../../SendResponseCallback';
import type { User } from '../../../User';
import { HookResult, Module } from '../../Module';
import type { ModuleComponentHolder } from '../../ModuleComponentHolder';
import { ChannelKeyModeHandler } from './ChannelKeyModeHandler';

export class ChannelKeyModule extends Module {
	private readonly _channelKeyModeHandler = new ChannelKeyModeHandler();

	init(components: ModuleComponentHolder): void {
		components.addMode(this._channelKeyModeHandler);
		components.addHook('channelJoin', this.onChannelJoin);
	}

	onChannelJoin = (
		channel: Channel,
		user: User,
		cmd: MessageTypes.Commands.ChannelJoin,
		respond: SendResponseCallback
	): HookResult => {
		if (!this._channelKeyModeHandler.keyIs(channel, cmd.params.key)) {
			respond(MessageTypes.Numerics.Error475BadChannelKey, {
				channel: channel.name,
				suffix: 'Cannot join channel (+k)'
			});
			return HookResult.DENY;
		}

		return HookResult.NEXT;
	};
}
