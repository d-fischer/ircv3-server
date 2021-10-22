import type {
	AccessLevelDefinition,
	Message,
	MessageConstructor,
	MessageParamValues,
	MessagePrefix,
	SupportedModesByType
} from 'ircv3';
import {
	createMessage,
	MessageTypes,
	NotEnoughParametersError,
	ParameterRequirementMismatchError,
	parseMessage
} from 'ircv3';
import * as net from 'net';
import { Channel } from './Channel';
import type { CommandHandler } from './Commands/CommandHandler';
import { ChannelJoinHandler } from './Commands/CoreCommands/ChannelJoinHandler';
import { ChannelKickHandler } from './Commands/CoreCommands/ChannelKickHandler';
import { ChannelPartHandler } from './Commands/CoreCommands/ChannelPartHandler';
import { ClientQuitHandler } from './Commands/CoreCommands/ClientQuitHandler';
import { ModeCommandHandler } from './Commands/CoreCommands/ModeCommandHandler';
import { NamesHandler } from './Commands/CoreCommands/NamesHandler';
import { NickChangeHandler } from './Commands/CoreCommands/NickChangeHandler';
import { PingHandler } from './Commands/CoreCommands/PingHandler';
import { PrivmsgHandler } from './Commands/CoreCommands/PrivmsgHandler';
import { TopicHandler } from './Commands/CoreCommands/TopicHandler';
import { UserRegistrationHandler } from './Commands/CoreCommands/UserRegistrationHandler';
import type { ModeHandler, ModeType } from './Modes/ModeHandler';
import type { Module } from './Modules/Module';
import { ModuleResult } from './Modules/Module';
import type { ModuleHook, ModuleHookTypes } from './Modules/ModuleHook';
import type { OperLogin } from './OperLogin';
import { assertNever } from './Toolkit/TypeTools';
import { User } from './User';

export type CaseMapping = 'ascii' | 'rfc1459' | 'rfc1459-strict';

export interface ServerConfiguration {
	serverAddress: string;
	serverName?: string;
	version?: string;
	caseMapping?: CaseMapping;
	channelLimit?: number;
	channelLength?: number;
	nickLength?: number;
}

export interface InternalAccessLevelDefinition extends AccessLevelDefinition {
	name: string;
	minLevelToSet: string;
}

export class Server {
	private readonly _serverAddress: string;
	private readonly _serverName: string;
	private readonly _version: string;
	private readonly _caseMapping: CaseMapping;
	private readonly _channelLimit: number;
	private readonly _channelLength: number;
	private readonly _nickLength: number;

	private readonly _users: User[] = [];
	private readonly _nickUserMap = new Map<string, User>();
	private readonly _channels = new Map<string, Channel>();
	private readonly _commands = new Map<string, CommandHandler>();

	private readonly _operLogins: OperLogin[] = [];

	private readonly _netServer = net.createServer(async socket => await this.initClientConnection(socket));
	private readonly _startupTime = new Date();

	private readonly _hooksByType = new Map(
		(
			[
				'userCreate',
				'userDestroy',
				'preTopicChange',
				'channelMessage',
				'modeChange',
				'channelCreate',
				'channelJoin'
			] as Array<keyof ModuleHookTypes>
		).map((hookName): [keyof ModuleHookTypes, Set<ModuleHook<never>>] => [hookName, new Set<ModuleHook<never>>()])
	);

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

	constructor(config: ServerConfiguration) {
		this._serverAddress = config.serverAddress;
		this._serverName = config.serverName ?? config.serverAddress;
		this._version = config.version ?? 'node-ircv3-server-0.0.1';
		this._caseMapping = config.caseMapping ?? 'ascii';
		this._channelLimit = config.channelLimit ?? 50;
		this._channelLength = config.channelLength ?? 32;
		this._nickLength = config.nickLength ?? 31;

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

	addOperLogin(login: OperLogin): void {
		this._operLogins.push(login);
	}

	loginAsOper(userName: string, password: string): OperLogin | null {
		return this._operLogins.find(l => l.userName === userName && l.password === password) ?? null;
	}

	get channels(): Map<string, Channel> {
		return new Map(this._channels);
	}

	get supportedChannelModes(): SupportedModesByType {
		return {
			prefix: this._prefixes.reduceRight((result, prefix) => result + prefix.modeChar, ''),
			list: '',
			alwaysWithParam: '',
			paramWhenSet: '',
			noParam: Array.from(this._registeredModes)
				.filter(mode => mode.type === 'channel')
				.map(mode => mode.letter)
				.sort()
				.join('')
		};
	}

	get supportedUserModes(): string {
		return Array.from(this._registeredModes)
			.filter(mode => mode.type === 'user')
			.map(mode => mode.letter)
			.sort()
			.join('');
	}

	get nickLength(): number {
		return this._nickLength;
	}

	getPrefixDefinitionByModeChar(char: string): InternalAccessLevelDefinition | null {
		return this._prefixes.find(def => def.modeChar === char) ?? null;
	}

	getAccessLevelByModeChar(char: string): number {
		return this._prefixes.findIndex(def => def.modeChar === char);
	}

	getAccessLevelByName(name: string): number {
		return this._prefixes.findIndex(def => def.name === name);
	}

	listen(port: number, bindIp?: string): void {
		this._netServer.listen(port, bindIp);
	}

	get serverAddress(): string {
		return this._serverAddress;
	}

	get serverPrefix(): MessagePrefix {
		return {
			nick: this._serverAddress
		};
	}

	async initClientConnection(socket: net.Socket): Promise<void> {
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
						originalCommand: cmd.command,
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
						originalCommand: e.command,
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

				console.error(`Error processing command: "${line}"`);
				console.error(e);
			}
		});
		user.onRegister(() => {
			this._nickUserMap.set(this._caseFoldString(user.nick!), user);
			user.sendNumericReply(MessageTypes.Numerics.Reply001Welcome, {
				welcomeText: 'the server welcomes you!'
			});
			user.sendNumericReply(MessageTypes.Numerics.Reply002YourHost, {
				yourHost: `Your host is ${this._serverAddress}, running version ${this._version}`
			});
			user.sendNumericReply(MessageTypes.Numerics.Reply003Created, {
				createdText: `This server was created ${this._startupTime.toISOString()}`
			});
			const channelModes = this.supportedChannelModes;
			user.sendNumericReply(MessageTypes.Numerics.Reply004ServerInfo, {
				serverName: this._serverAddress,
				version: this._version,
				userModes: this.supportedUserModes,
				channelModes: Object.values(channelModes).join('').split('').sort().join('')
			});
			const reversedPrefixes = [...this._prefixes].reverse();
			const prefixString = `(${reversedPrefixes.map(pref => pref.modeChar).join('')})${reversedPrefixes
				.map(pref => pref.prefix)
				.join('')}`;
			const chanModesString = `${channelModes.list},${channelModes.alwaysWithParam},${channelModes.paramWhenSet},${channelModes.noParam}`;
			user.sendNumericReply(MessageTypes.Numerics.Reply005Isupport, {
				supports: `CHANTYPES=# CHANLIMIT=#:${this._channelLimit} CHANNELLEN=${this._channelLength} NICKLEN=${this._nickLength} NETWORK=${this._serverName} CHANMODES=${chanModesString} PREFIX=${prefixString} CASEMAPPING=${this._caseMapping}`,
				suffix: 'are supported by this server'
			});
			if (user.modesAsString) {
				user.sendNumericReply(MessageTypes.Numerics.Reply221UmodeIs, {
					modes: user.modesAsString
				});
			}
			this.sendMotd(user);
		});
		user.onNickChange(oldNick => {
			const newNickCaseFolded = this._caseFoldString(user.nick!);
			if (!oldNick) {
				this._nickUserMap.set(newNickCaseFolded, user);
				return;
			}
			const oldNickCaseFolded = this._caseFoldString(oldNick);
			if (newNickCaseFolded !== oldNickCaseFolded) {
				this._nickUserMap.delete(oldNickCaseFolded);
				this._nickUserMap.set(newNickCaseFolded, user);
			}
		});
		this._users.push(user);
		await user.resolveUserIp();
	}

	sendMotd(user: User): void {
		user.sendNumericReply(MessageTypes.Numerics.Error422NoMotd, {
			suffix: 'MOTD File is missing'
		});
	}

	joinChannel(user: User, channel: string | Channel): void {
		const channelName = typeof channel === 'string' ? channel : channel.name;
		if (user.channels.size >= this._channelLimit) {
			user.sendNumericReply(MessageTypes.Numerics.Error405TooManyChannels, {
				channel: channelName,
				suffix: 'You have joined too many channels'
			});
			return;
		}
		if (channelName.length > this._channelLength) {
			user.sendNumericReply(MessageTypes.Numerics.Error479BadChanName, {
				channel: channelName,
				suffix: 'Illegal channel name'
			});
			return;
		}
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

		const res = this.callHook('channelJoin', channel, user);
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

		channel.broadcastMessage(
			this.createMessage(
				MessageTypes.Commands.ChannelJoin,
				{
					channel: channel.name
				},
				user.prefix
			)
		);
		channel.sendTopic(user, false);

		channel.sendNames(user);
	}

	partChannel(user: User, channel: string | Channel): void {
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
				suffix: "You're not on that channel"
			});
		}

		channel.broadcastMessage(
			this.createMessage(
				MessageTypes.Commands.ChannelPart,
				{
					channel: channel.name
				},
				user.prefix
			)
		);

		this.unlinkUserFromChannel(user, channel);
	}

	nickExists(nick: string): boolean {
		return this._nickUserMap.has(this._caseFoldString(nick));
	}

	nickChangeAllowed(oldNick: string | undefined, newNick: string): boolean {
		if (oldNick && this._caseFoldString(oldNick) === this._caseFoldString(newNick)) {
			return true;
		}
		return !this.nickExists(newNick);
	}

	getUserByNick(nick: string): User | undefined {
		return this._nickUserMap.get(this._caseFoldString(nick));
	}

	getChannelByName(name: string): Channel | undefined {
		return this._channels.get(this._caseFoldString(name));
	}

	destroyConnection(user: User): void {
		if (!user.destroy()) {
			return;
		}
		if (user.isRegistered) {
			this.broadcastToCommonChannelUsers(
				user,
				this.createMessage(MessageTypes.Commands.ClientQuit, {
					message: 'Bye bye!'
				})
			);
			for (const channel of user.channels) {
				this.unlinkUserFromChannel(user, channel);
			}
			if (user.nick) {
				this._nickUserMap.delete(this._caseFoldString(user.nick));
			}
		}
		const index = this._users.findIndex(u => u === user);
		if (index === -1) {
			console.error(`Could not find index of user ${user.connectionIdentifier}`);
		} else {
			this._users.splice(index, 1);
		}
		console.log(`${user.connectionIdentifier} disconnected. ${this._users.length} remaining.`);
	}

	unlinkUserFromChannel(user: User, channel: Channel): void {
		// can happen on multiple occasions - part, kick, quit
		user.removeChannel(channel);
		channel.removeUser(user);
	}

	destroyChannel(channel: Channel): void {
		// usually, this should only happen when a channel is empty, but we kick everyone just in case
		for (const user of channel.users) {
			const msg = this.createMessage(MessageTypes.Commands.ChannelKick, {
				// people in channels should have a nick
				target: user.nick!,
				channel: channel.name,
				comment: 'Channel is being destroyed'
			});
			user.sendMessage(msg);
			this.unlinkUserFromChannel(user, channel);
		}

		this._channels.delete(this._caseFoldString(channel.name));
	}

	createMessage<T extends Message>(
		type: MessageConstructor<T>,
		params: Partial<MessageParamValues<T>>,
		prefix: MessagePrefix = this.serverPrefix
	): T {
		return createMessage(type, params, prefix, undefined, undefined, true);
	}

	broadcastToCommonChannelUsers(user: User, msg: Message): void {
		const commonUsers = new Set<User>();

		for (const channel of user.channels) {
			for (const commonUser of channel.users) {
				if (commonUser !== user) {
					commonUsers.add(commonUser);
				}
			}
		}

		for (const commonUser of commonUsers) {
			commonUser.sendMessage(msg);
		}
	}

	findModeByLetter(letter: string, type: ModeType): ModeHandler | undefined {
		return Array.from(this._registeredModes).find(mode => mode.type === type && mode.letter === letter);
	}

	findModeByName(name: string, type: ModeType): ModeHandler | undefined {
		return Array.from(this._registeredModes).find(mode => mode.type === type && mode.name === name);
	}

	loadModule<T extends Module>(moduleClass: new () => T): void {
		const module = new moduleClass();
		module.load(this);
	}

	addModuleHook(hook: ModuleHook<never>): void {
		if (this._hooksByType.has(hook.type)) {
			this._hooksByType.get(hook.type)!.add(hook);
		}
	}

	removeModuleHook(hook: ModuleHook<never>): void {
		this._hooksByType.get(hook.type)?.delete(hook);
	}

	addMode(mode: ModeHandler): void {
		this._registeredModes.add(mode);
	}

	removeMode(mode: ModeHandler): void {
		this._registeredModes.delete(mode);
	}

	addCommand(command: CommandHandler): boolean {
		if (this._commands.has(command.command)) {
			return false;
		}
		this._commands.set(command.command, command);
		return true;
	}

	removeCommand(command: CommandHandler): void {
		this._commands.delete(command.command);
	}

	callHook<HookType extends keyof ModuleHookTypes>(
		name: HookType,
		...args: Parameters<ModuleHookTypes[HookType]>
	): ModuleResult {
		const hooks = this._hooksByType.get(name)!;
		let result = ModuleResult.NEXT;

		for (const hook of hooks) {
			result = (hook as ModuleHook<HookType>).call(...args);

			if (result !== ModuleResult.NEXT) {
				break;
			}
		}

		return result;
	}

	private _caseFoldString(str: string) {
		switch (this._caseMapping) {
			case 'ascii': {
				return str.replace(/[A-Z]/g, l => l.toLowerCase());
			}
			case 'rfc1459':
			case 'rfc1459-strict': {
				const specialReplacements: Record<string, string | undefined> = {
					'[': '{',
					']': '}',
					'\\': '|'
				};
				if (this._caseMapping === 'rfc1459-strict') {
					specialReplacements['~'] = '^';
				}
				return str.replace(/[A-Z[\]\\~]/g, l => specialReplacements[l] ?? l.toLowerCase());
			}
			default: {
				return assertNever(this._caseMapping);
			}
		}
	}
}
