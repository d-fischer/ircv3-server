import { SimpleChannelModeHandler } from '../../../Modes/SimpleChannelModeHandler';

export class NoExternalMessagesModeHandler extends SimpleChannelModeHandler {
	constructor() {
		super('noExternalMessages', 'n', 'op');
	}
}
