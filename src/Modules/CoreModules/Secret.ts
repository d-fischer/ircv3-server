import type { Channel } from '../../Channel';
import { NoParamChannelModeHandler } from '../../Modes/Channel/NoParamChannelModeHandler';
import type { User } from '../../User';
import { HookResult, Module } from '../Module';
import type { ModuleComponentHolder } from '../ModuleComponentHolder';
import type { ChannelVisibilityResult } from '../ModuleHook';

export class SecretModule extends Module {
	private readonly _secretMode = new NoParamChannelModeHandler('secret', 's', 'op');

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
