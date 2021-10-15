import { Module, ModuleResult } from '../../Module';
import type Channel from '../../../Channel';
import type { User } from '../../../User';
import NoExternalMessagesModeHandler from './NoExternalMessagesModeHandler';
import type ModuleComponentHolder from '../../ModuleComponentHolder';
import { MessageTypes } from 'ircv3';

export default class NoExternalMessagesModule extends Module {
	private readonly _noExternalMessagesMode = new NoExternalMessagesModeHandler();

	init(components: ModuleComponentHolder): void {
		components.addMode(this._noExternalMessagesMode);
		components.addHook('channelMessage', this.onChannelMessage);
		components.addHook('channelCreate', this.onChannelCreate);
	}

	onChannelMessage = (channel: Channel, user: User): ModuleResult => {
		if (channel.hasModeSet(this._noExternalMessagesMode) && !channel.containsUser(user)) {
			user.sendNumericReply(MessageTypes.Numerics.Error404CanNotSendToChan, {
				channel: channel.name,
				suffix: 'Cannot send to channel'
			});
			return ModuleResult.DENY;
		}

		return ModuleResult.NEXT;
	};

	onChannelCreate = (channel: Channel): ModuleResult => {
		channel.addMode(this._noExternalMessagesMode);

		return ModuleResult.NEXT;
	};
}
