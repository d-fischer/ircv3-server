import { SimpleChannelModeHandler } from '../../../Modes/SimpleChannelModeHandler';

export class TopicLockModeHandler extends SimpleChannelModeHandler {
	constructor() {
		super('topicLock', 't', 'op');
	}
}
