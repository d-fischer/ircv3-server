import { MessageTypes, UnknownChannelModeCharError } from 'ircv3';
import type { SendResponseCallback } from '../../SendResponseCallback';
import type { Server } from '../../Server';
import { partition } from '../../Toolkit/ArrayTools';
import type { User } from '../../User';
import { CommandHandler } from '../CommandHandler';

export class ModeCommandHandler extends CommandHandler<MessageTypes.Commands.Mode> {
	constructor() {
		super(MessageTypes.Commands.Mode);
	}

	handleCommand(cmd: MessageTypes.Commands.Mode, user: User, server: Server, respond: SendResponseCallback): void {
		if (cmd.isChannel) {
			const channel = server.getChannelByName(cmd.params.target);
			if (!channel) {
				respond(MessageTypes.Numerics.Error403NoSuchChannel, {
					channel: cmd.params.target,
					suffix: 'No such channel'
				});
				return;
			}
			if (!cmd.params.modes) {
				respond(MessageTypes.Numerics.Reply324ChannelModeIs, {
					channel: channel.name,
					modes: channel.modesAsString
				});
				return;
			}
			try {
				const modes = cmd.separate();
				channel.processModes(modes, user, respond);
			} catch (e) {
				if (e instanceof UnknownChannelModeCharError) {
					respond(MessageTypes.Numerics.Error472UnknownMode, {
						char: e.char,
						suffix: 'is an unknown mode char to me'
					});
				} else {
					throw e;
				}
			}
		} else {
			if (cmd.params.target !== user.nick) {
				respond(MessageTypes.Numerics.Error502UsersDontMatch, {
					suffix: `Can't ${cmd.params.modes ? 'change' : 'view'} modes for other users`
				});
				return;
			}
			if (!cmd.params.modes) {
				respond(MessageTypes.Numerics.Reply221UmodeIs, {
					modes: user.modesAsString
				});
				return;
			}
			const [unknownModes, knownModes] = partition(cmd.separate(), mode => mode.known);
			if (unknownModes.length) {
				for (const unknownMode of unknownModes) {
					respond(MessageTypes.Numerics.Error501UmodeUnknownFlag, {
						modeChar: unknownMode.letter,
						suffix: 'Unknown MODE Flag'
					});
				}
			}
			if (knownModes.length) {
				user.processModes(knownModes, user, respond);
			}
		}
	}
}
