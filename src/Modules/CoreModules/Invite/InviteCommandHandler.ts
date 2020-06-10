import CommandHandler from '../../../Commands/CommandHandler';
import ChannelInvite from 'ircv3/lib/Message/MessageTypes/Commands/ChannelInvite';
import User from '../../../User';
import Server from '../../../Server';
import InviteOnlyModeHandler from './InviteOnlyModeHandler';
import * as Numerics from 'ircv3/lib/Message/MessageTypes/Numerics';
import Invite from './Invite';
import InviteModule from './index';

export default class InviteCommandHandler extends CommandHandler<ChannelInvite> {
	constructor(private _inviteOnlyMode: InviteOnlyModeHandler, private _inviteModule: InviteModule) {
		super(ChannelInvite);
	}

	handleCommand({ params: { channel: channelName, target: targetNick } }: ChannelInvite, user: User, server: Server) {
		const channel = server.getChannelByName(channelName);
		if (!channel) {
			user.sendNumericReply(Numerics.Error403NoSuchChannel, {
				channel: channelName,
				suffix: 'No such channel'
			});
			return;
		}
		if (!channel.containsUser(user)) {
			user.sendNumericReply(Numerics.Error442NotOnChannel, {
				channel: channel.name,
				suffix: 'You\'re not on that channel'
			});
			return;
		}

		const target = server.getUserByNick(targetNick);
		if (!target) {
			user.sendNumericReply(Numerics.Error401NoSuchNick, {
				nick: targetNick,
				suffix: 'No such nick'
			});
			return;
		}
		if (channel.containsUser(target)) {
			user.sendNumericReply(Numerics.Error443UserOnChannel, {
				nick: target.nick,
				channel: channel.name,
				suffix: 'is already on channel'
			});
			return;
		}

		if (channel.hasModeSet(this._inviteOnlyMode) && !channel.isUserAtLeast(user, 'halfop')) {
			user.sendNumericReply(Numerics.Error482ChanOPrivsNeeded, {
				channel: channel.name,
				suffix: 'You need channel privileges to do this'
			});
			return;
		}

		this._inviteModule._addInvite(new Invite(target, channel, user));

		user.sendNumericReply(Numerics.Reply341Inviting, {
			channel: channel.name,
			nick: target.nick
		});

		target.sendMessage(ChannelInvite, {
			channel: channel.name,
			target: target.nick
		}, user.prefix);
	}
}
