import CommandHandler from '../CommandHandler';
import Mode from 'ircv3/lib/Message/MessageTypes/Commands/Mode';
import User from '../../User';
import Server from '../../Server';
import * as Numerics from 'ircv3/lib/Message/MessageTypes/Numerics';
import { UnknownChannelModeCharError } from 'ircv3';
import { partition } from '../../Toolkit/ArrayTools';

export default class ModeCommandHandler extends CommandHandler<Mode> {
	constructor() {
		super(Mode);
	}

	handleCommand(cmd: Mode, user: User, server: Server) {
		user.ifRegistered(() => {
			if (cmd.isChannel) {
				const channel = server.getChannelByName(cmd.params.target);
				if (!channel) {
					user.sendNumericReply(Numerics.Error403NoSuchChannel, {
						channel: cmd.params.target,
						suffix: 'No such channel'
					});
					return;
				}
				if (!cmd.params.modes) {
					user.sendNumericReply(Numerics.Reply324ChannelModeIs, {
						channel: channel.name,
						modes: channel.modesAsString
					});
					return;
				}
				try {
					const modes = cmd.separate();
					channel.processModes(modes, user);
				} catch (e) {
					if (e instanceof UnknownChannelModeCharError) {
						user.sendNumericReply(Numerics.Error472UnknownMode, {
							char: e.char,
							suffix: 'is an unknown mode char to me'
						});
					} else {
						throw e;
					}
				}
			} else {
				if (cmd.params.target !== user.nick) {
					user.sendNumericReply(Numerics.Error502UsersDontMatch, {
						suffix: `Can't ${cmd.params.modes ? 'change' : 'view'} modes for other users`
					});
					return;
				}
				if (!cmd.params.modes) {
					user.sendNumericReply(Numerics.Reply221UModeIs, {
						modes: user.modesAsString
					});
					return;
				}
				const [unknownModes, knownModes] = partition(cmd.separate(), mode => mode.known);
				if (unknownModes.length) {
					user.sendNumericReply(Numerics.Error501UModeUnknownFlag, {
						suffix: 'Unknown MODE Flag'
					});
				}
				if (knownModes.length) {
					user.processModes(knownModes);
				}
			}
		});
	}
}
