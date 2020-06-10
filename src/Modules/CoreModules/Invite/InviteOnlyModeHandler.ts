import SimpleChannelModeHandler from '../../../Modes/SimpleChannelModeHandler';

export default class InviteOnlyModeHandler extends SimpleChannelModeHandler {
	constructor() {
		super('inviteOnly', 'i', 'op');
	}
}
