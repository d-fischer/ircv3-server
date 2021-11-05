import { MessageTypes } from 'ircv3';
import { CommandHandler } from '../CommandHandler';

export class PongHandler extends CommandHandler<MessageTypes.Commands.Pong> {
	constructor() {
		super(MessageTypes.Commands.Pong);
	}

	handleCommand(): void {
		// just kinda ignore it for now
	}
}
