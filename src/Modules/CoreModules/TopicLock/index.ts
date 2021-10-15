import { Module, ModuleResult } from '../../Module';
import { MessageTypes } from 'ircv3';
import type Channel from '../../../Channel';
import type { User } from '../../../User';
import TopicLockModeHandler from './TopicLockModeHandler';
import type ModuleComponentHolder from '../../ModuleComponentHolder';

export default class TopicLockModule extends Module {
	private readonly _topicLockMode = new TopicLockModeHandler();

	init(components: ModuleComponentHolder): void {
		components.addMode(this._topicLockMode);
	}

	onPreTopicChange(channel: Channel, user: User): ModuleResult {
		if (channel.hasModeSet(this._topicLockMode) && !channel.isUserAtLeast(user, 'op')) {
			user.sendNumericReply(MessageTypes.Numerics.Error482ChanOpPrivsNeeded, {
				channel: channel.name,
				suffix: 'You do not have access to change the topic on this channel'
			});
			return ModuleResult.DENY;
		}

		return ModuleResult.NEXT;
	}

	onChannelCreate(channel: Channel): ModuleResult {
		channel.addMode(this._topicLockMode);

		return ModuleResult.NEXT;
	}
}
