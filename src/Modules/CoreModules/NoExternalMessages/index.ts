import type { SendResponseCallback } from '../../../SendResponseCallback';
import { Module, ModuleResult } from '../../Module';
import type { Channel } from '../../../Channel';
import type { User } from '../../../User';
import type { ChannelCreateFlags } from '../../ModuleHook';
import { NoExternalMessagesModeHandler } from './NoExternalMessagesModeHandler';
import type { ModuleComponentHolder } from '../../ModuleComponentHolder';
import { MessageTypes } from 'ircv3';

export class NoExternalMessagesModule extends Module {
	private readonly _noExternalMessagesMode = new NoExternalMessagesModeHandler();

	init(components: ModuleComponentHolder): void {
		components.addMode(this._noExternalMessagesMode);
		components.addHook('channelMessage', (channel, user, _, respond) => this.handle(channel, user, respond));
		components.addHook('channelNotice', (channel, user, _, respond) => this.handle(channel, user, respond));
		components.addHook('channelTagMessage', this.handle);
		components.addHook('afterChannelCreate', this.onChannelCreate);
	}

	handle = (channel: Channel, user: User, respond: SendResponseCallback): ModuleResult => {
		if (channel.hasModeSet(this._noExternalMessagesMode) && !channel.containsUser(user)) {
			respond(MessageTypes.Numerics.Error404CanNotSendToChan, {
				channel: channel.name,
				suffix: 'Cannot send to channel'
			});
			return ModuleResult.DENY;
		}

		return ModuleResult.NEXT;
	};

	onChannelCreate = (channel: Channel, user: User, result: ChannelCreateFlags): ModuleResult => {
		result.modesToSet.push({ mode: this._noExternalMessagesMode });

		return ModuleResult.NEXT;
	};
}
