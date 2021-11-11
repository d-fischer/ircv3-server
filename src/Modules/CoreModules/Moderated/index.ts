import { MessageTypes } from 'ircv3';
import type { Channel } from '../../../Channel';
import type { SendResponseCallback } from '../../../SendResponseCallback';
import type { User } from '../../../User';
import { HookResult, Module } from '../../Module';
import type { ModuleComponentHolder } from '../../ModuleComponentHolder';
import { ModeratedModeHandler } from './ModeratedModeHandler';

export class ModeratedModule extends Module {
	private readonly _moderatedMode = new ModeratedModeHandler();

	init(components: ModuleComponentHolder): void {
		components.addMode(this._moderatedMode);
		components.addHook('channelMessage', (channel, user, _, respond) => this.handle(channel, user, respond));
		components.addHook('channelNotice', (channel, user, _, respond) => this.handle(channel, user, respond));
		components.addHook('channelTagMessage', this.handle);
	}

	handle = (channel: Channel, user: User, respond: SendResponseCallback): HookResult => {
		if (channel.hasModeSet(this._moderatedMode) && !channel.isUserAtLeast(user, 'voice')) {
			respond(MessageTypes.Numerics.Error404CanNotSendToChan, {
				channel: channel.name,
				suffix: 'Cannot send to channel (+m)'
			});
			return HookResult.DENY;
		}

		return HookResult.NEXT;
	};
}
