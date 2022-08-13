import { MessageTypes } from 'ircv3';
import type { SendResponseCallback } from '../../SendResponseCallback';
import type { Server } from '../../Server';
import type { User } from '../../User';
import { CommandHandler } from '../CommandHandler';

export class AwayHandler extends CommandHandler<MessageTypes.Commands.Away> {
	constructor() {
		super(MessageTypes.Commands.Away);
	}

	handleCommand(cmd: MessageTypes.Commands.Away, user: User, server: Server, respond: SendResponseCallback): void {
		// handle empty string too, even though it shouldn't come through to here
		// eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
		const msg = cmd.params.message || null;

		user.setAwayMessage(msg);
		if (msg == null) {
			respond(MessageTypes.Numerics.Reply305UnAway, {
				suffix: 'You are no longer marked as being away'
			});
		} else {
			respond(MessageTypes.Numerics.Reply306NowAway, {
				suffix: 'You have been marked as being away'
			});
		}
	}
}
