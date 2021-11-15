import type { Channel } from '../../../Channel';
import { ParamAlwaysChannelModeHandler } from '../../../Modes/Channel/ParamAlwaysChannelModeHandler';
import type { Server } from '../../../Server';
import type { User } from '../../../User';

export class ChannelKeyModeHandler extends ParamAlwaysChannelModeHandler {
	constructor() {
		super('key', 'k', 'op');
	}

	checkValidity(channel: Channel, user: User, server: Server, adding: boolean, param?: string): boolean {
		return adding || this._getCurrentParam(channel) === param;
	}

	keyIs(channel: Channel, keyToCheck: string | undefined): boolean {
		const currentKey = this._getCurrentParam(channel);
		return !currentKey || currentKey === keyToCheck;
	}
}
