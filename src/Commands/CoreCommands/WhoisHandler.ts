import { MessageTypes } from 'ircv3';
import type { ChannelVisibilityResult } from '../../Modules/ModuleHook';
import type { SendResponseCallback } from '../../SendResponseCallback';
import type { Server } from '../../Server';
import { joinChunks } from '../../Toolkit/StringTools';
import type { User } from '../../User';
import { CommandHandler } from '../CommandHandler';

export class WhoisHandler extends CommandHandler<MessageTypes.Commands.WhoIsQuery> {
	constructor() {
		super(MessageTypes.Commands.WhoIsQuery);
	}

	handleCommand(
		cmd: MessageTypes.Commands.WhoIsQuery,
		user: User,
		server: Server,
		respond: SendResponseCallback
	): void {
		const foundUser = server.getUserByNick(cmd.params.nickMask);

		if (foundUser?.isRegistered) {
			respond(MessageTypes.Numerics.Reply311WhoisUser, {
				nick: foundUser.nick!,
				username: foundUser.userName!,
				host: foundUser.publicHostNameAsParam,
				_unused: '*',
				realname: foundUser.realName!
			});

			const shownChannels = [...foundUser.channels].filter(channel => {
				const visibility: ChannelVisibilityResult = {
					secret: false
				};

				server.callHook('channelCheckVisibility', channel, user, visibility);

				return !visibility.secret;
			});

			// Channels need to be chunked because the list may be too long.
			// An IRC line can have 510 characters, excluding the trailing CRLF.
			// From that we subtract the following fixed characters:
			// :<serveraddr> 319 <username> <nick> :<channels>
			// ^            ^   ^          ^      ^^
			// to get 510 - 6 = 504 available characters.
			// The things that are still missing are the length of the numeric
			// and the <serveraddr>, <username> and <nick> placeholders.
			// After subtracting these, we have the maximum length the tokens can have.
			const limit =
				504 -
				server.serverAddress.length -
				MessageTypes.Numerics.Reply319WhoisChannels.COMMAND.length -
				user.connectionIdentifier.length -
				foundUser.nick!.length;

			const lines = joinChunks(
				shownChannels.map(
					channel => `${channel.getPrefixDefinitionForUser(foundUser)?.prefix ?? ''}${channel.name}`
				),
				limit
			);
			for (const channels of lines) {
				respond(MessageTypes.Numerics.Reply319WhoisChannels, {
					nick: foundUser.nick!,
					channels
				});
			}
		} else {
			respond(MessageTypes.Numerics.Error401NoSuchNick, {
				nick: cmd.params.nickMask,
				suffix: 'No such nick'
			});
		}

		respond(MessageTypes.Numerics.Reply318EndOfWhois, {
			nickMask: cmd.params.nickMask,
			suffix: 'End of /WHOIS list'
		});
	}
}
