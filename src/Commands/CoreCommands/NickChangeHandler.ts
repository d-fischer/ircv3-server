import { MessageTypes } from 'ircv3';
import CommandHandler from '../CommandHandler';
import type { User } from '../../User';
import { assertNever } from '../../Toolkit/TypeTools';
import type { Server } from '../../Server';

export default class NickChangeHandler extends CommandHandler<MessageTypes.Commands.NickChange> {
	constructor() {
		super(MessageTypes.Commands.NickChange);
	}

	handleCommand(cmd: MessageTypes.Commands.NickChange, user: User, server: Server): void {
		const registered = user.isRegistered;
		const newNick = cmd.params.nick;
		if (newNick === user.nick) {
			return;
		}
		const oldPrefix = user.isRegistered ? user.prefix : { nick: '*' };
		const result = user.setNick(newNick);
		switch (result) {
			case 'invalid': {
				user.sendNumericReply(MessageTypes.Numerics.Error432ErroneusNickname, {
					nick: newNick,
					suffix: 'This nick is invalid'
				});
				break;
			}
			case 'inUse': {
				user.sendNumericReply(MessageTypes.Numerics.Error433NickNameInUse, {
					nick: newNick,
					suffix: 'Nick already in use'
				});
				break;
			}
			case 'ok': {
				if (registered) {
					server.broadcastToCommonChannelUsers(
						user,
						MessageTypes.Commands.NickChange,
						{
							nick: newNick
						},
						true,
						oldPrefix
					);
				}
				break;
			}
			default:
				assertNever(result);
		}
	}
}
