import CommandHandler from '../CommandHandler';
import ChannelKick from 'ircv3/lib/Message/MessageTypes/Commands/ChannelKick';
import User from '../../User';
import Server from '../../Server';
import * as Numerics from 'ircv3/lib/Message/MessageTypes/Numerics';

export default class ChannelKickHandler extends CommandHandler<ChannelKick> {
	constructor() {
		super(ChannelKick);
	}

	handleCommand({ params: { channel: channelName, target, comment } }: ChannelKick, user: User, server: Server) {
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

		const victim = server.getUserByNick(target);
		if (!victim) {
			user.sendNumericReply(Numerics.Error401NoSuchNick, {
				nick: target,
				suffix: 'No such nick'
			});
			return;
		}
		if (!channel.containsUser(victim)) {
			user.sendNumericReply(Numerics.Error441UserNotInChannel, {
				nick: victim.nick,
				channel: channel.name,
				suffix: 'They are\'nt on that channel'
			});
			return;
		}

		if (!channel.isUserAtLeast(user, 'halfop')) {
			user.sendNumericReply(Numerics.Error482ChanOPrivsNeeded, {
				channel: channel.name,
				suffix: 'You need channel privileges to do this'
			});
			return;
		}

		const victimLevel = channel.getPrefixDefinitionForUser(victim);
		if (victimLevel && !channel.isUserAtLeast(user, victimLevel.minLevelToSet)) {
			user.sendNumericReply(Numerics.Error482ChanOPrivsNeeded, {
				channel: channel.name,
				suffix: 'You need channel privileges to do this'
			});
			return;
		}

		channel.broadcastMessage(ChannelKick, {
			channel: channel.name,
			target: victim.nick,
			comment
		}, user.prefix);
		server.unlinkUserFromChannel(victim, channel);
	}
}
