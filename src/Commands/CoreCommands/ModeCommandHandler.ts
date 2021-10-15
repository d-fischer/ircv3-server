import CommandHandler from '../CommandHandler';
import type { User } from '../../User';
import type { Server } from '../../Server';
import { MessageTypes, UnknownChannelModeCharError } from 'ircv3';
import { partition } from '../../Toolkit/ArrayTools';

export default class ModeCommandHandler extends CommandHandler<MessageTypes.Commands.Mode> {
	constructor() {
		super(MessageTypes.Commands.Mode);
	}

	handleCommand(cmd: MessageTypes.Commands.Mode, user: User, server: Server): void {
		user.ifRegistered(() => {
			if (cmd.isChannel) {
				const channel = server.getChannelByName(cmd.params.target);
				if (!channel) {
					user.sendNumericReply(MessageTypes.Numerics.Error403NoSuchChannel, {
						channel: cmd.params.target,
						suffix: 'No such channel'
					});
					return;
				}
				if (!cmd.params.modes) {
					user.sendNumericReply(MessageTypes.Numerics.Reply324ChannelModeIs, {
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
						user.sendNumericReply(MessageTypes.Numerics.Error472UnknownMode, {
							char: e.char,
							suffix: 'is an unknown mode char to me'
						});
					} else {
						throw e;
					}
				}
			} else {
				if (cmd.params.target !== user.nick) {
					user.sendNumericReply(MessageTypes.Numerics.Error502UsersDontMatch, {
						suffix: `Can't ${cmd.params.modes ? 'change' : 'view'} modes for other users`
					});
					return;
				}
				if (!cmd.params.modes) {
					user.sendNumericReply(MessageTypes.Numerics.Reply221UmodeIs, {
						modes: user.modesAsString
					});
					return;
				}
				const [unknownModes, knownModes] = partition(cmd.separate(), mode => mode.known);
				if (unknownModes.length) {
					user.sendNumericReply(MessageTypes.Numerics.Error501UmodeUnknownFlag, {
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
