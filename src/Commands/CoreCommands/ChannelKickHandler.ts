import type { SendResponseCallback } from '../../SendResponseCallback';
import { CommandHandler } from '../CommandHandler';
import { MessageTypes } from 'ircv3';
import type { User } from '../../User';
import type { Server } from '../../Server';

export class ChannelKickHandler extends CommandHandler<MessageTypes.Commands.ChannelKick> {
	constructor() {
		super(MessageTypes.Commands.ChannelKick);
	}

	handleCommand(
		cmd: MessageTypes.Commands.ChannelKick,
		user: User,
		server: Server,
		respond: SendResponseCallback
	): void {
		const {
			params: { channel: channelName, target, comment }
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

		if (!channel.isUserAtLeast(user, 'halfop')) {
			respond(MessageTypes.Numerics.Error482ChanOpPrivsNeeded, {
				channel: channel.name,
				suffix: 'You need channel privileges to do this'
			});
			return;
		}

		const victim = server.getUserByNick(target);
		if (!victim) {
			respond(MessageTypes.Numerics.Error401NoSuchNick, {
				nick: target,
				suffix: 'No such nick'
			});
			return;
		}
		if (!channel.containsUser(victim)) {
			respond(MessageTypes.Numerics.Error441UserNotInChannel, {
				nick: victim.nick!,
				channel: channel.name,
				suffix: "They aren't on that channel"
			});
			return;
		}

		const victimLevel = channel.getPrefixDefinitionForUser(victim);
		if (victimLevel && !channel.isUserAtLeast(user, victimLevel.minLevelToSet)) {
			respond(MessageTypes.Numerics.Error482ChanOpPrivsNeeded, {
				channel: channel.name,
				suffix: 'You need channel privileges to do this'
			});
			return;
		}

		respond(
			MessageTypes.Commands.ChannelKick,
			{
				channel: channel.name,
				target: victim.nick!,
				comment
			},
			user.prefix
		);

		channel.broadcastMessage(
			MessageTypes.Commands.ChannelKick,
			{
				channel: channel.name,
				target: victim.nick!,
				comment
			},
			user.prefix,
			undefined,
			user
		);
		server.unlinkUserFromChannel(victim, channel);
	}
}
