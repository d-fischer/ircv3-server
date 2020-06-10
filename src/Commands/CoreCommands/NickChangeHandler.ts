import CommandHandler from '../CommandHandler';
import NickChange from 'ircv3/lib/Message/MessageTypes/Commands/NickChange';
import User from '../../User';
import * as Numerics from 'ircv3/lib/Message/MessageTypes/Numerics';
import { assertNever } from '../../Toolkit/TypeTools';
import Server from '../../Server';

export default class NickChangeHandler extends CommandHandler<NickChange> {
	constructor() {
		super(NickChange);
	}

	handleCommand(cmd: NickChange, user: User, server: Server) {
		const registered = user.isRegistered;
		const newNick = cmd.params.nick;
		if (newNick === user.nick) {
			return;
		}
		const oldPrefix = user.isRegistered ? user.prefix : { nick: '*' };
		const result = user.setNick(newNick);
		switch (result) {
			case 'invalid': {
				user.sendNumericReply(Numerics.Error432ErroneusNickname, {
					nick: newNick,
					suffix: 'This nick is invalid'
				});
				break;
			}
			case 'inUse': {
				user.sendNumericReply(Numerics.Error433NickNameInUse, {
					nick: newNick,
					suffix: 'Nick already in use'
				});
				break;
			}
			case 'ok': {
				if (registered) {
					server.broadcastToCommonChannelUsers(user, NickChange, {
						nick: newNick
					}, true, oldPrefix);
				}
				break;
			}
			default:
				assertNever(result);
		}
	}
}
