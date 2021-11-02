import { MessageTypes } from 'ircv3';
import type { SendResponseCallback } from '../../SendResponseCallback';
import { CommandHandler } from '../CommandHandler';
import type { User } from '../../User';
import { assertNever } from '../../Toolkit/TypeTools';
import type { Server } from '../../Server';

export class NickChangeHandler extends CommandHandler<MessageTypes.Commands.NickChange> {
	constructor() {
		super(MessageTypes.Commands.NickChange);
		this._requiresRegistration = false;
	}

	handleCommand(
		cmd: MessageTypes.Commands.NickChange,
		user: User,
		server: Server,
		respond: SendResponseCallback
	): void {
		const registered = user.isRegistered;
		const newNick = cmd.params.nick;
		if (newNick === user.nick) {
			return;
		}
		const oldPrefix = user.isRegistered ? user.prefix : { nick: '*' };
		const result = user.setNick(newNick);
		switch (result.result) {
			case 'invalid': {
				respond(MessageTypes.Numerics.Error432ErroneusNickname, {
					nick: newNick,
					suffix: 'This nick is invalid'
				});
				break;
			}
			case 'inUse': {
				respond(MessageTypes.Numerics.Error433NickNameInUse, {
					nick: newNick,
					suffix: 'Nick already in use'
				});
				break;
			}
			case 'ok': {
				if (registered) {
					respond(
						MessageTypes.Commands.NickChange,
						{
							nick: result.newNick
						},
						oldPrefix
					);
					server.forEachCommonChannelUser(user, commonUser => {
						commonUser.sendMessage(
							MessageTypes.Commands.NickChange,
							{
								nick: result.newNick
							},
							oldPrefix
						);
					});
				}
				break;
			}
			default:
				assertNever(result);
		}
	}
}
