import { isChannel, MessageTypes } from 'ircv3';
import { HookResult } from '../../Modules/Module';
import type { SendResponseCallback } from '../../SendResponseCallback';
import type { Server } from '../../Server';
import type { User } from '../../User';
import { CommandHandler } from '../CommandHandler';

export class ChannelJoinHandler extends CommandHandler<MessageTypes.Commands.ChannelJoin> {
	constructor() {
		super(MessageTypes.Commands.ChannelJoin);
	}

	handleCommand(
		cmd: MessageTypes.Commands.ChannelJoin,
		user: User,
		server: Server,
		respond: SendResponseCallback
	): void {
		const channelName = cmd.params.channel;
		if (!isChannel(channelName)) {
			respond(MessageTypes.Numerics.Error403NoSuchChannel, {
				channel: channelName,
				suffix: 'No such channel'
			});
			return;
		}

		if (!this.checkBasicJoinRequirements(user, channelName, server, respond)) {
			return;
		}

		const channel = server.getChannelByName(channelName);
		if (channel) {
			const res = server.callHook('channelJoin', channel, user, cmd, respond);
			if (res === HookResult.DENY) {
				return;
			}

			server.doJoinChannel(user, channel, false, respond);
		} else {
			// avoid creating a channel that already exists at all costs
			if (server.getChannelByName(channelName) !== null) {
				return;
			}

			const res = server.callHook('channelCreate', channelName, user, respond);
			if (res === HookResult.DENY) {
				return;
			}

			server.doCreateChannel(user, channelName, respond);
		}
	}

	checkBasicJoinRequirements(
		user: User,
		channelName: string,
		server: Server,
		respond: SendResponseCallback
	): boolean {
		if (user.channels.size >= server.channelLimit) {
			respond(MessageTypes.Numerics.Error405TooManyChannels, {
				channel: channelName,
				suffix: 'You have joined too many channels'
			});
			return false;
		}
		if (channelName.length > server.channelLength) {
			respond(MessageTypes.Numerics.Error479BadChanName, {
				channel: channelName,
				suffix: 'Illegal channel name'
			});
			return false;
		}

		return true;
	}
}
