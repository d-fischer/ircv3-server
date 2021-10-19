import { MessageTypes } from 'ircv3';
import { CommandHandler } from '../CommandHandler';
import type { User } from '../../User';
import type { Server } from '../../Server';
import { ModuleResult } from '../../Modules/Module';

export class TopicHandler extends CommandHandler<MessageTypes.Commands.Topic> {
	constructor() {
		super(MessageTypes.Commands.Topic);
	}

	handleCommand(cmd: MessageTypes.Commands.Topic, user: User, server: Server): void {
		user.ifRegistered(() => {
			const { channel: channelName, newTopic } = cmd.params;

			if (channelName) {
				const channel = server.getChannelByName(channelName);

				if (channel) {
					if (newTopic) {
						const result = server.callHook('preTopicChange', channel, user, newTopic);
						if (result !== ModuleResult.DENY) {
							channel.changeTopic(newTopic, user);
						}
					} else {
						channel.sendTopic(user);
					}
					return;
				}
			}
			user.sendNumericReply(MessageTypes.Numerics.Error403NoSuchChannel, {
				channel: channelName,
				suffix: 'No such channel'
			});
		});
	}
}
