import { SimpleChannelModeHandler } from '../../../Modes/SimpleChannelModeHandler';

export class SecretModeHandler extends SimpleChannelModeHandler {
	constructor() {
		super('secret', 's', 'op');
	}
}
