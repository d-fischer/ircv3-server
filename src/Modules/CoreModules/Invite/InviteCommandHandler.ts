import { MessageTypes } from 'ircv3';
import { CommandHandler } from '../../../Commands/CommandHandler';
import type { SendResponseCallback } from '../../../SendResponseCallback';
import type { User } from '../../../User';
import type { Server } from '../../../Server';
import type { InviteOnlyModeHandler } from './InviteOnlyModeHandler';
import { Invite } from './Invite';
import type { InviteModule } from './index';

export class InviteCommandHandler extends CommandHandler<MessageTypes.Commands.ChannelInvite> {
	constructor(private readonly _inviteOnlyMode: InviteOnlyModeHandler, private readonly _inviteModule: InviteModule) {
		super(MessageTypes.Commands.ChannelInvite);
	}

	handleCommand(
		cmd: MessageTypes.Commands.ChannelInvite,
		user: User,
		server: Server,
		respond: SendResponseCallback
	): void {
		const {
			params: { channel: channelName, target: targetNick }
		} = cmd;
		const channel = server.getChannelByName(channelName);

		if (!channel) {
			respond(MessageTypes.Numerics.Error403NoSuchChannel, {
				channel: channelName,
				suffix: 'No such channel'
			});
			return;
		}
		if (!channel.containsUser(user)) {
			respond(MessageTypes.Numerics.Error442NotOnChannel, {
				channel: channel.name,
				suffix: "You're not on that channel"
			});
			return;
		}

		if (channel.hasModeSet(this._inviteOnlyMode) && !channel.isUserAtLeast(user, 'halfop')) {
			respond(MessageTypes.Numerics.Error482ChanOpPrivsNeeded, {
				channel: channel.name,
				suffix: 'You need channel privileges to do this'
			});
			return;
		}

		const target = server.getUserByNick(targetNick);
		if (!target) {
			respond(MessageTypes.Numerics.Error401NoSuchNick, {
				nick: targetNick,
				suffix: 'No such nick'
			});
			return;
		}
		if (channel.containsUser(target)) {
			respond(MessageTypes.Numerics.Error443UserOnChannel, {
				nick: target.nick!,
				channel: channel.name,
				suffix: 'is already on channel'
			});
			return;
		}

		this._inviteModule._addInvite(new Invite(target, channel, user));

		respond(MessageTypes.Numerics.Reply341Inviting, {
			channel: channel.name,
			nick: target.nick!
		});

		target.sendMessage(
			MessageTypes.Commands.ChannelInvite,
			{
				channel: channel.name,
				target: target.nick!
			},
			user.prefix
		);
	}
}
