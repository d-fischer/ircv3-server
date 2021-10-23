import { CommandHandler } from '../CommandHandler';
import { MessageTypes } from 'ircv3';
import type { User } from '../../User';
import type { Server } from '../../Server';

export class ChannelKickHandler extends CommandHandler<MessageTypes.Commands.ChannelKick> {
	constructor() {
		super(MessageTypes.Commands.ChannelKick);
	}

	handleCommand(
		{ params: { channel: channelName, target, comment } }: MessageTypes.Commands.ChannelKick,
		user: User,
		server: Server
	): void {
		const channel = server.getChannelByName(channelName);
		if (!channel) {
			user.sendNumericReply(MessageTypes.Numerics.Error403NoSuchChannel, {
				channel: channelName,
				suffix: 'No such channel'
			});
			return;
		}

		if (!channel.containsUser(user)) {
			user.sendNumericReply(MessageTypes.Numerics.Error442NotOnChannel, {
				channel: channel.name,
				suffix: "You're not on that channel"
			});
			return;
		}

		if (!channel.isUserAtLeast(user, 'halfop')) {
			user.sendNumericReply(MessageTypes.Numerics.Error482ChanOpPrivsNeeded, {
				channel: channel.name,
				suffix: 'You need channel privileges to do this'
			});
			return;
		}

		const victim = server.getUserByNick(target);
		if (!victim) {
			user.sendNumericReply(MessageTypes.Numerics.Error401NoSuchNick, {
				nick: target,
				suffix: 'No such nick'
			});
			return;
		}
		if (!channel.containsUser(victim)) {
			user.sendNumericReply(MessageTypes.Numerics.Error441UserNotInChannel, {
				nick: victim.nick,
				channel: channel.name,
				suffix: "They are'nt on that channel"
			});
			return;
		}

		const victimLevel = channel.getPrefixDefinitionForUser(victim);
		if (victimLevel && !channel.isUserAtLeast(user, victimLevel.minLevelToSet)) {
			user.sendNumericReply(MessageTypes.Numerics.Error482ChanOpPrivsNeeded, {
				channel: channel.name,
				suffix: 'You need channel privileges to do this'
			});
			return;
		}

		channel.broadcastMessage(
			server.createMessage(
				MessageTypes.Commands.ChannelKick,
				{
					channel: channel.name,
					target: victim.nick,
					comment
				},
				user.prefix
			)
		);
		server.unlinkUserFromChannel(victim, channel);
	}
}
