import { SimpleChannelModeHandler } from '../../../Modes/SimpleChannelModeHandler';

export class InviteOnlyModeHandler extends SimpleChannelModeHandler {
	constructor() {
		super('inviteOnly', 'i', 'op');
	}
}
