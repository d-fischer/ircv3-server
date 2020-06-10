import CommandHandler from '../CommandHandler';
import Topic from 'ircv3/lib/Message/MessageTypes/Commands/Topic';
import User from '../../User';
import Server from '../../Server';
import { ModuleResult } from '../../Modules/Module';
import * as Numerics from 'ircv3/lib/Message/MessageTypes/Numerics';

export default class TopicHandler extends CommandHandler<Topic> {
	constructor() {
		super(Topic);
	}

	handleCommand(cmd: Topic, user: User, server: Server) {
		user.ifRegistered(() => {
			const { channel: channelName, newTopic } = cmd.params;

			if (channelName) {
				const channel = server.getChannelByName(channelName);

				if (channel) {
					if (newTopic) {
						const result = server.callHook('onPreTopicChange', channel, user, newTopic);
						if (result !== ModuleResult.DENY) {
							channel.changeTopic(newTopic, user);
						}
					} else {
						channel.sendTopic(user);
					}
					return;
				}
			}
			user.sendNumericReply(Numerics.Error403NoSuchChannel, {
				channel: channelName,
				suffix: 'No such channel'
			});
		});
	}
}
