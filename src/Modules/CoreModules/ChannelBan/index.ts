import { MessageTypes } from 'ircv3';
import type { Channel } from '../../../Channel';
import type { SendResponseCallback } from '../../../SendResponseCallback';
import type { Server } from '../../../Server';
import type { User } from '../../../User';
import { HookResult, Module } from '../../Module';
import type { ModuleComponentHolder } from '../../ModuleComponentHolder';
import { ChannelBanExceptionModeHandler } from './ChannelBanExceptionModeHandler';
import { ChannelBanModeHandler } from './ChannelBanModeHandler';

export class ChannelBanModule extends Module {
	private readonly _banMode = new ChannelBanModeHandler();
	private readonly _banExceptionMode = new ChannelBanExceptionModeHandler();

	init(components: ModuleComponentHolder): void {
		components.addMode(this._banMode);
		components.addMode(this._banExceptionMode);
		components.addHook('channelJoin', this.onChannelJoin);
	}

	onChannelJoin = (
		channel: Channel,
		user: User,
		cmd: MessageTypes.Commands.ChannelJoin,
		respond: SendResponseCallback,
		server: Server
	): HookResult => {
		if (this._banMode.matches(channel, user, server) && !this._banExceptionMode.matches(channel, user, server)) {
			respond(MessageTypes.Numerics.Error474BannedFromChan, {
				channel: channel.name,
				suffix: 'Cannot join channel (+b)'
			});
			return HookResult.DENY;
		}

		return HookResult.NEXT;
	};
}
