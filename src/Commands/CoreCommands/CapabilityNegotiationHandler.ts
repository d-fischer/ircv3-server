import { MessageTypes } from 'ircv3';
import type { SendResponseCallback } from '../../SendResponseCallback';
import type { Server } from '../../Server';
import { joinChunks } from '../../Toolkit/StringTools';
import type { User } from '../../User';
import { CommandHandler } from '../CommandHandler';

interface CapabilityNegotiationOperation {
	operation: 'add' | 'remove';
	name: string;
}

export class CapabilityNegotiationHandler extends CommandHandler<MessageTypes.Commands.CapabilityNegotiation> {
	constructor() {
		super(MessageTypes.Commands.CapabilityNegotiation);
		this._requiresRegistration = false;
	}

	handleCommand(
		cmd: MessageTypes.Commands.CapabilityNegotiation,
		user: User,
		server: Server,
		respond: SendResponseCallback
	): void {
		switch (cmd.params.subCommand) {
			case 'LS': {
				const ver = Number(cmd.params.version);
				const cleanVer = Number.isNaN(ver) ? 301 : ver;
				if (!user.isRegistered) {
					user.capabilitiesNegotiating = true;
				}
				user.updateCapVersion(cleanVer);
				// An IRC line can have 510 characters, excluding the trailing CRLF.
				// From that we subtract the following fixed characters:
				// :<serveraddr> CAP <target> LS * :<tokens>
				// ^            ^   ^        ^^^^^^^
				// to get 510 - 10 = 500 available characters.
				// (510 - 8 = 502 for below 302)
				// The things that are still missing are the length of the command and the <serveraddr> and <target> placeholders.
				// After subtracting these, we have the maximum length the tokens can have.
				const limit =
					(cleanVer >= 302 ? 500 : 502) -
					MessageTypes.Commands.CapabilityNegotiation.COMMAND.length -
					server.serverAddress.length -
					user.connectionIdentifier.length;

				const lines = joinChunks(server.capabilityNames, limit);

				lines.forEach((capabilities, i) => {
					respond(MessageTypes.Commands.CapabilityNegotiation, {
						target: user.connectionIdentifier,
						subCommand: 'LS',
						continued: cleanVer >= 302 && i < lines.length - 1 ? '*' : undefined,
						capabilities
					});
				});
				break;
			}
			case 'REQ': {
				const requestedCaps = (cmd.params.capabilities?.split(' ') ?? []).map<CapabilityNegotiationOperation>(
					capNameWithOp =>
						capNameWithOp.startsWith('-')
							? {
									operation: 'remove',
									name: capNameWithOp.slice(1)
							  }
							: {
									operation: 'add',
									name: capNameWithOp
							  }
				);
				const serverCaps = server.capabilityNames;
				if (requestedCaps.every(cap => serverCaps.includes(cap.name))) {
					for (const cap of requestedCaps) {
						const capObj = server.getCapabilityByName(cap.name)!;
						if (cap.operation === 'add') {
							user.addCapability(capObj);
						} else {
							user.removeCapability(capObj);
						}
					}
					respond(MessageTypes.Commands.CapabilityNegotiation, {
						target: user.connectionIdentifier,
						subCommand: 'ACK',
						capabilities: cmd.params.capabilities
					});
				} else {
					respond(MessageTypes.Commands.CapabilityNegotiation, {
						target: user.connectionIdentifier,
						subCommand: 'NAK',
						capabilities: cmd.params.capabilities
					});
				}
				break;
			}
			case 'LIST': {
				// An IRC line can have 510 characters, excluding the trailing CRLF.
				// From that we subtract the following fixed characters:
				// :<serveraddr> CAP <target> LIST * :<tokens>
				// ^            ^   ^        ^^^^^^^^^
				// to get 510 - 12 = 498 available characters.
				// (510 - 10 = 500 for below 302)
				// The things that are still missing are the length of the command and the <serveraddr> and <target> placeholders.
				// After subtracting these, we have the maximum length the tokens can have.
				const capVersion = user.capabilityNegotiationVersion ?? 0;
				const limit =
					(capVersion >= 302 ? 498 : 500) -
					MessageTypes.Commands.CapabilityNegotiation.COMMAND.length -
					server.serverAddress.length -
					user.connectionIdentifier.length;

				const lines = joinChunks(user.capabilityNames, limit);

				lines.forEach((capabilities, i) => {
					respond(MessageTypes.Commands.CapabilityNegotiation, {
						target: user.connectionIdentifier,
						subCommand: 'LIST',
						continued: capVersion >= 302 && i < lines.length - 1 ? '*' : undefined,
						capabilities
					});
				});
				break;
			}
			case 'END': {
				user.capabilitiesNegotiating = false;
				break;
			}
			default: {
				respond(MessageTypes.Numerics.Error410InvalidCapCmd, {
					subCommand: cmd.params.subCommand,
					suffix: 'Invalid CAP command'
				});
			}
		}
	}
}
