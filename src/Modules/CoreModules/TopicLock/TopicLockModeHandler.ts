import SimpleChannelModeHandler from '../../../Modes/SimpleChannelModeHandler';

export default class TopicLockModeHandler extends SimpleChannelModeHandler {
	constructor() {
		super('topicLock', 't', 'op');
	}
}
