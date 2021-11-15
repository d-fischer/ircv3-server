import { MessageTypes } from 'ircv3';
import type { Channel } from '../../Channel';
import { NoParamChannelModeHandler } from '../../Modes/Channel/NoParamChannelModeHandler';
import type { SendResponseCallback } from '../../SendResponseCallback';
import type { User } from '../../User';
import { HookResult, Module } from '../Module';
import type { ModuleComponentHolder } from '../ModuleComponentHolder';
import type { ChannelCreateFlags } from '../ModuleHook';

export class NoExternalMessagesModule extends Module {
	private readonly _noExternalMessagesMode = new NoParamChannelModeHandler('noExternalMessages', 'n', 'op');

	init(components: ModuleComponentHolder): void {
		components.addMode(this._noExternalMessagesMode);
		components.addHook('channelMessage', (channel, user, _, respond) => this.handle(channel, user, respond));
		components.addHook('channelNotice', (channel, user, _, respond) => this.handle(channel, user, respond));
		components.addHook('channelTagMessage', this.handle);
		components.addHook('afterChannelCreate', this.onChannelCreate);
	}

	handle = (channel: Channel, user: User, respond: SendResponseCallback): HookResult => {
		if (channel.hasModeSet(this._noExternalMessagesMode) && !channel.containsUser(user)) {
			respond(MessageTypes.Numerics.Error404CanNotSendToChan, {
				channel: channel.name,
				suffix: 'Cannot send to channel'
			});
			return HookResult.DENY;
		}

		return HookResult.NEXT;
	};

	onChannelCreate = (channel: Channel, user: User, result: ChannelCreateFlags): HookResult => {
		result.modesToSet.push({ mode: this._noExternalMessagesMode });

		return HookResult.NEXT;
	};
}
