import * as net from 'net';
import User from './User';
import { AccessLevelDefinition, MessageConstructor, MessagePrefix, MessageTypes, NotEnoughParametersError, ParameterRequirementMismatchError, parseMessage, SupportedModesByType } from 'ircv3';
import Channel from './Channel';
import { ArgumentTypes } from './Toolkit/TypeTools';
import Module, { ModuleHooks, ModuleResult } from './Modules/Module';
import ModeHandler, { ModeType } from './Modes/ModeHandler';
import CommandHandler from './Commands/CommandHandler';
import UserRegistrationHandler from './Commands/CoreCommands/UserRegistrationHandler';
import NickChangeHandler from './Commands/CoreCommands/NickChangeHandler';
import ClientQuitHandler from './Commands/CoreCommands/ClientQuitHandler';
import PingHandler from './Commands/CoreCommands/PingHandler';
import PrivmsgHandler from './Commands/CoreCommands/PrivmsgHandler';
import ModeCommandHandler from './Commands/CoreCommands/ModeCommandHandler';
import ChannelJoinHandler from './Commands/CoreCommands/ChannelJoinHandler';
import ChannelPartHandler from './Commands/CoreCommands/ChannelPartHandler';
import NamesHandler from './Commands/CoreCommands/NamesHandler';
import { ConstructedType, MessageParams } from 'ircv3/lib/Toolkit/TypeTools';
import ChannelKickHandler from './Commands/CoreCommands/ChannelKickHandler';
import TopicHandler from './Commands/CoreCommands/TopicHandler';

export interface ServerConfiguration {
	serverAddress: string;
	serverName?: string;
	version?: string;
}

export interface InternalAccessLevelDefinition extends AccessLevelDefinition {
	name: string;
	minLevelToSet: string;
}

export default class Server {
	private readonly _users: User[] = [];
	private readonly _nickUserMap = new Map<string, User>();
	private readonly _channels = new Map<string, Channel>();
	private readonly _commands = new Map<string, CommandHandler>();

	private readonly _netServer = net.createServer(socket => this.initClientConnection(socket));
	private readonly _startupTime = new Date();

	private readonly _moduleHooks = new Map(([
		'onUserCreate',
		'onUserDestroy',
		'onPreTopicChange',
		'onChannelMessage',
		'onModeChange',
		'onChannelCreate',
		'onChannelJoin'
	] as Array<keyof ModuleHooks>).map((hookName): [keyof ModuleHooks, Set<ModuleHooks>] => [hookName, new Set<ModuleHooks>()]));

	private readonly _prefixes: InternalAccessLevelDefinition[] = [
		{
			name: 'voice',
			modeChar: 'v',
			prefix: '+',
			minLevelToSet: 'halfop'
		},
		{
			name: 'halfop',
			modeChar: 'h',
			prefix: '%',
			minLevelToSet: 'op'
		},
		{
			name: 'op',
			modeChar: 'o',
			prefix: '@',
			minLevelToSet: 'op'
		},
		{
			name: 'admin',
			modeChar: 'a',
			prefix: '&',
			minLevelToSet: 'owner'
		},
		{
			name: 'owner',
			modeChar: 'q',
			prefix: '~',
			minLevelToSet: 'owner'
		}
	];

	private readonly _registeredModes = new Set<ModeHandler>();

	get supportedChannelModes(): SupportedModesByType {
		return {
			prefix: this._prefixes.reduceRight((result, prefix) => result + prefix.modeChar, ''),
			list: '',
			alwaysWithParam: '',
			paramWhenSet: '',
			noParam: Array.from(this._registeredModes).filter(mode => mode.type === 'channel').map(mode => mode.letter).sort().join('')
		};
	}

	get supportedUserModes() {
		return Array.from(this._registeredModes).filter(mode => mode.type === 'user').map(mode => mode.letter).sort().join('');
	}

	getPrefixDefinitionByModeChar(char: string) {
		return this._prefixes.find(def => def.modeChar === char);
	}

	getAccessLevelByModeChar(char: string) {
		return this._prefixes.findIndex(def => def.modeChar === char);
	}

	getAccessLevelByName(name: string) {
		return this._prefixes.findIndex(def => def.name === name);
	}

	constructor(private readonly _config: ServerConfiguration) {
		if (!_config.serverName) {
			_config.serverName = _config.serverAddress;
		}
		if (!_config.version) {
			_config.version = `node-ircv3-server-${require('../package.json').version}`;
		}

		this.addCommand(new UserRegistrationHandler());
		this.addCommand(new NickChangeHandler());
		this.addCommand(new ClientQuitHandler());
		this.addCommand(new PingHandler());
		this.addCommand(new PrivmsgHandler());
		this.addCommand(new ModeCommandHandler());
		this.addCommand(new ChannelJoinHandler());
		this.addCommand(new ChannelPartHandler());
		this.addCommand(new NamesHandler());
		this.addCommand(new TopicHandler());
		this.addCommand(new ChannelKickHandler());
	}

	listen(port: number, bindIp?: string) {
		this._netServer.listen(port, bindIp);
	}

	get serverAddress(): string {
		return this._config.serverAddress;
	}

	get serverPrefix(): MessagePrefix {
		return {
			nick: this._config.serverAddress
		};
	}

	initClientConnection(socket: net.Socket) {
		const user = new User(this, socket);
		user.onLine(line => {
			try {
				const cmd = parseMessage(line, {
					supportedUserModes: this.supportedUserModes,
					supportedChannelModes: this.supportedChannelModes,
					channelTypes: '#',
					prefixes: this._prefixes
				});
				if (this._commands.has(cmd.command)) {
					const handler = this._commands.get(cmd.command)!;
					handler.handleCommand(cmd, user, this);
				} else {
					user.sendNumericReply(MessageTypes.Numerics.Error421UnknownCommand, {
						command: cmd.command,
						suffix: 'Unknown command'
					});
				}
			} catch (e) {
				if (e instanceof NotEnoughParametersError) {
					if (e.command === 'NICK') {
						user.sendNumericReply(MessageTypes.Numerics.Error431NoNickNameGiven, {
							suffix: 'No nick name given'
						});
						return;
					}
					user.sendNumericReply(MessageTypes.Numerics.Error461NeedMoreParams, {
						command: e.command,
						suffix: 'Not enough parameters'
					});
					return;
				}
				if (e instanceof ParameterRequirementMismatchError) {
					if (e.paramSpec.type === 'channel' || e.paramSpec.type === 'channelList') {
						user.sendNumericReply(MessageTypes.Numerics.Error403NoSuchChannel, {
							channel: e.givenValue,
							suffix: 'No such channel'
						});
						return;
					}
				}

				// tslint:disable:no-console
				console.error(`Error processing command: "${line}"`);
				console.error(e);
				// tslint:enable:no-console
			}
		});
		user.onRegister(() => {
			this._nickUserMap.set(user.nick!, user);
			user.sendNumericReply(MessageTypes.Numerics.Reply001Welcome, {
				welcomeText: 'the server welcomes you!'
			});
			user.sendNumericReply(MessageTypes.Numerics.Reply002YourHost, {
				yourHost: `Your host is ${this._config.serverAddress}, running version ${this._config.version}`
			});
			user.sendNumericReply(MessageTypes.Numerics.Reply003Created, {
				createdText: `This server was created ${this._startupTime.toISOString()}`
			});
			const channelModes = this.supportedChannelModes;
			user.sendNumericReply(MessageTypes.Numerics.Reply004ServerInfo, {
				serverName: this._config.serverAddress,
				version: this._config.version,
				userModes: this.supportedUserModes,
				channelModes: Object.values(channelModes).join('').split('').sort().join('')
			});
			const reversedPrefixes = [...this._prefixes].reverse();
			const prefixString = `(${reversedPrefixes.map(pref => pref.modeChar).join('')})${reversedPrefixes.map(pref => pref.prefix).join('')}`;
			const chanModesString = `${channelModes.list},${channelModes.alwaysWithParam},${channelModes.paramWhenSet},${channelModes.noParam}`;
			user.sendNumericReply(MessageTypes.Numerics.Reply005ISupport, {
				supports: `CHANTYPES=# NETWORK=${this._config.serverName} CHANMODES=${chanModesString} PREFIX=${prefixString}`,
				suffix: 'are supported by this server'
			});
			if (user.modesAsString) {
				user.sendNumericReply(MessageTypes.Numerics.Reply221UModeIs, {
					modes: user.modesAsString
				});
			}
			this.sendMOTD(user);
		});
		user.onNickChange(oldNick => {
			if (oldNick) {
				this._nickUserMap.delete(oldNick);
			}
			this._nickUserMap.set(user.nick!, user);
		});
		this._users.push(user);
	}

	sendMOTD(user: User) {
		user.sendNumericReply(MessageTypes.Numerics.Error422NoMOTD, {
			suffix: 'MOTD File is missing'
		});
	}

	joinChannel(user: User, channel: string | Channel) {
		let isFirst = false;
		if (typeof channel === 'string') {
			const foldedName = this._caseFoldString(channel);
			let channelObject = this._channels.get(foldedName);
			if (!channelObject) {
				isFirst = true;
				channelObject = new Channel(channel, user, this);
				this._channels.set(foldedName, channelObject);
			}
			channel = channelObject;
		}

		const res = this.callHook('onChannelJoin', channel, user);
		if (res === ModuleResult.DENY) {
			if (isFirst) {
				this._channels.delete(this._caseFoldString(channel.name));
			}
			return;
		}

		if (channel.users.has(user)) {
			return;
		}

		user.addChannel(channel);
		channel.addUser(user, isFirst);

		channel.broadcastMessage(MessageTypes.Commands.ChannelJoin, {
			channel: channel.name
		}, user.prefix);
		channel.sendTopic(user, false);

		channel.sendNames(user);
	}

	partChannel(user: User, channel: string | Channel) {
		if (typeof channel === 'string') {
			const channelObject = this.getChannelByName(channel);
			if (!channelObject) {
				user.sendNumericReply(MessageTypes.Numerics.Error403NoSuchChannel, {
					channel,
					suffix: 'No such channel'
				});
				return;
			}
			channel = channelObject;
		}

		if (!channel.users.has(user)) {
			user.sendNumericReply(MessageTypes.Numerics.Error442NotOnChannel, {
				channel: channel.name,
				suffix: 'You\'re not on that channel'
			});
		}

		channel.broadcastMessage(MessageTypes.Commands.ChannelPart, {
			channel: channel.name
		}, user.prefix);

		this.unlinkUserFromChannel(user, channel);
	}

	nickExists(nick: string) {
		return this._nickUserMap.has(this._caseFoldString(nick));
	}

	getUserByNick(nick: string) {
		return this._nickUserMap.get(this._caseFoldString(nick));
	}

	getChannelByName(name: string) {
		return this._channels.get(this._caseFoldString(name));
	}

	destroyConnection(user: User) {
		if (!user.destroy()) {
			return;
		}
		for (const channel of user.channels) {
			this.unlinkUserFromChannel(user, channel);
		}
		this.broadcastToCommonChannelUsers(user, MessageTypes.Commands.ClientQuit, {
			message: 'Bye bye!'
		});
		const index = this._users.findIndex(u => u === user);
		if (index === -1) {
			// tslint:disable-next-line:no-console
			console.error(`Could not find index of user ${user.connectionIdentifier}`);
		} else {
			this._users.splice(index, 1);
		}
		if (user.nick) {
			this._nickUserMap.delete(user.nick);
		}
		// tslint:disable-next-line:no-console
		console.log(`${user.connectionIdentifier} disconnected. ${this._users.length} remaining.`);
	}

	unlinkUserFromChannel(user: User, channel: Channel) {
		// can happen on multiple occasions - part, kick, quit
		user.removeChannel(channel);
		channel.removeUser(user);
	}

	destroyChannel(channel: Channel) {
		// usually, this should only happen when a channel is empty, but we kick everyone just in case
		for (const user of channel.users) {
			user.sendMessage(MessageTypes.Commands.ChannelKick, {
				target: user.nick,
				channel: channel.name,
				comment: 'Channel is being destroyed'
			});
			this.unlinkUserFromChannel(user, channel);
		}

		this._channels.delete(this._caseFoldString(channel.name));
	}

	broadcastToCommonChannelUsers<T extends MessageConstructor>(user: User, type: T, params: MessageParams<ConstructedType<T>>, includeSelf: boolean = false, prefix: MessagePrefix = user.prefix) {
		const commonUsers = new Set<User>();

		for (const channel of user.channels) {
			for (const commonUser of channel.users) {
				if (includeSelf || commonUser !== user) {
					commonUsers.add(commonUser);
				}
			}
		}

		for (const commonUser of commonUsers) {
			commonUser.sendMessage(type, params, prefix);
		}
	}

	findMode(letter: string, type: ModeType): ModeHandler | undefined {
		for (const mode of this._registeredModes) {
			if (mode.type === type && mode.letter === letter) {
				return mode;
			}
		}
	}

	private _caseFoldString(str: string) {
		return str.toLowerCase();
	}

	loadModule<T extends Module>(moduleClass: { new(): T }) {
		const module = new moduleClass();
		module.load(this);
		for (const hookName of Object.keys(moduleClass.prototype) as Array<keyof ModuleHooks>) {
			if (this._moduleHooks.has(hookName)) {
				this._moduleHooks.get(hookName)!.add(module);
			}
		}
	}

	unloadModule(module: Module) {
		for (const hookSet of this._moduleHooks.values()) {
			hookSet.delete(module);
		}
	}

	addMode(mode: ModeHandler) {
		this._registeredModes.add(mode);
	}

	removeMode(mode: ModeHandler) {
		this._registeredModes.delete(mode);
	}

	findModeByLetter(letter: string, type: ModeType) {
		return Array.from(this._registeredModes).find(mode => mode.type === type && mode.letter === letter);
	}

	addCommand(command: CommandHandler) {
		if (this._commands.has(command.command)) {
			return false;
		}
		this._commands.set(command.command, command);
		return true;
	}

	removeCommand(command: CommandHandler) {
		this._commands.delete(command.command);
	}

	callHook<N extends keyof ModuleHooks>(name: N, ...args: ArgumentTypes<NonNullable<ModuleHooks[N]>>) {
		const hooks = this._moduleHooks.get(name)!;
		let result = ModuleResult.NEXT;

		for (const hookModule of hooks) {
			// TODO this doesn't work like this without weakening the type to Function - we should find out a better way than that
			const hookFunction: Function = hookModule[name]!;
			result = hookFunction.apply(hookModule, args);

			if (result !== ModuleResult.NEXT) {
				break;
			}
		}

		return result;
	}
}
