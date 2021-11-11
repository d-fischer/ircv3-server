import { SimpleChannelModeHandler } from '../../../Modes/SimpleChannelModeHandler';

export class ModeratedModeHandler extends SimpleChannelModeHandler {
	constructor() {
		super('moderated', 'm', 'halfop');
	}
}
