import SimpleChannelModeHandler from '../../../Modes/SimpleChannelModeHandler';

export default class NoExternalMessagesModeHandler extends SimpleChannelModeHandler {
	constructor() {
		super('noExternalMessages', 'n', 'op');
	}
}
