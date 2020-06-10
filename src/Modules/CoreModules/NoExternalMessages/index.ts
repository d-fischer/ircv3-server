import Module, { ModuleResult } from '../../Module';
import Channel from '../../../Channel';
import User from '../../../User';
import NoExternalMessagesModeHandler from './NoExternalMessagesModeHandler';
import ModuleComponentHolder from '../../ModuleComponentHolder';
import { MessageTypes } from 'ircv3';

export default class NoExternalMessagesModule extends Module {
	private readonly _noExternalMessagesMode = new NoExternalMessagesModeHandler();

	init(components: ModuleComponentHolder) {
		components.addMode(this._noExternalMessagesMode);
	}

	onChannelMessage(channel: Channel, user: User, message: string) {
		if (channel.hasModeSet(this._noExternalMessagesMode) && !channel.containsUser(user)) {
			user.sendNumericReply(MessageTypes.Numerics.Error404CanNotSendToChan, {
				channel: channel.name,
				suffix: 'Cannot send to channel'
			});
			return ModuleResult.DENY;
		}

		return ModuleResult.NEXT;
	};

	onChannelCreate(channel: Channel, user: User) {
		channel.addMode(this._noExternalMessagesMode);

		return ModuleResult.NEXT;
	}
}
