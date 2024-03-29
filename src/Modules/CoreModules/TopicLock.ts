import { MessageTypes } from 'ircv3';
import type { Channel } from '../../Channel';
import { NoParamChannelModeHandler } from '../../Modes/Channel/NoParamChannelModeHandler';
import type { SendResponseCallback } from '../../SendResponseCallback';
import type { User } from '../../User';
import { HookResult, Module } from '../Module';
import type { ModuleComponentHolder } from '../ModuleComponentHolder';
import type { ChannelCreateFlags } from '../ModuleHook';

export class TopicLockModule extends Module {
	private readonly _topicLockMode = new NoParamChannelModeHandler('topicLock', 't', 'op');

	init(components: ModuleComponentHolder): void {
		components.addMode(this._topicLockMode);
		components.addHook('preTopicChange', this.onPreTopicChange);
		components.addHook('afterChannelCreate', this.onChannelCreate);
	}

	onPreTopicChange = (channel: Channel, user: User, _: string, respond: SendResponseCallback): HookResult => {
		if (channel.hasModeSet(this._topicLockMode) && !channel.isUserAtLeast(user, 'op')) {
			respond(MessageTypes.Numerics.Error482ChanOpPrivsNeeded, {
				channel: channel.name,
				suffix: 'You do not have access to change the topic on this channel'
			});
			return HookResult.DENY;
		}

		return HookResult.NEXT;
	};

	onChannelCreate = (channel: Channel, user: User, result: ChannelCreateFlags): HookResult => {
		result.modesToSet.push({ mode: this._topicLockMode });

		return HookResult.NEXT;
	};
}
