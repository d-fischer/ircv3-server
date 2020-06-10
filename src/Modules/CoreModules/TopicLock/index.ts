import Module, { ModuleResult } from '../../Module';
import { MessageTypes } from 'ircv3';
import Channel from '../../../Channel';
import User from '../../../User';
import TopicLockModeHandler from './TopicLockModeHandler';
import ModuleComponentHolder from '../../ModuleComponentHolder';

export default class TopicLockModule extends Module {
	private readonly _topicLockMode = new TopicLockModeHandler();

	init(components: ModuleComponentHolder) {
		components.addMode(this._topicLockMode);
	}

	onPreTopicChange(channel: Channel, user: User) {
		if (channel.hasModeSet(this._topicLockMode) && !channel.isUserAtLeast(user, 'op')) {
			user.sendNumericReply(MessageTypes.Numerics.Error482ChanOPrivsNeeded, {
				channel: channel.name,
				suffix: 'You do not have access to change the topic on this channel'
			});
			return ModuleResult.DENY;
		}

		return ModuleResult.NEXT;
	}

	onChannelCreate(channel: Channel, user: User) {
		channel.addMode(this._topicLockMode);

		return ModuleResult.NEXT;
	}
}
