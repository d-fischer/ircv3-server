import type { Channel } from '../../../Channel';
import type { User } from '../../../User';
import { Module, HookResult } from '../../Module';
import type { ModuleComponentHolder } from '../../ModuleComponentHolder';
import type { ChannelVisibilityResult } from '../../ModuleHook';
import { SecretModeHandler } from './SecretModeHandler';

export class SecretModule extends Module {
	private readonly _secretMode = new SecretModeHandler();

	init(components: ModuleComponentHolder): void {
		components.addMode(this._secretMode);
		components.addHook('channelCheckVisibility', (channel, user, result) =>
			this.checkChannelVisibility(channel, user, result)
		);
	}

	checkChannelVisibility = (channel: Channel, user: User, result: ChannelVisibilityResult): HookResult => {
		result.secret ||= channel.hasModeSet(this._secretMode);
		return HookResult.NEXT;
	};
}
