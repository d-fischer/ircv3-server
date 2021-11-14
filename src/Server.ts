import type {
	AccessLevelDefinition,
	Capability,
	Message,
	MessageConstructor,
	MessageParamValues,
	MessagePrefix,
	ServerProperties,
	SupportedModesByType
} from 'ircv3';
import {
	CoreCapabilities,
	createMessage,
	MessageTypes,
	NotEnoughParametersError,
	ParameterRequirementMismatchError,
	parseMessage
} from 'ircv3';
import * as net from 'net';
import { Channel } from './Channel';
import type { CommandHandler } from './Commands/CommandHandler';
import { AwayHandler } from './Commands/CoreCommands/AwayHandler';
import { CapabilityNegotiationHandler } from './Commands/CoreCommands/CapabilityNegotiationHandler';
import { ChannelJoinHandler } from './Commands/CoreCommands/ChannelJoinHandler';
import { ChannelKickHandler } from './Commands/CoreCommands/ChannelKickHandler';
import { ChannelPartHandler } from './Commands/CoreCommands/ChannelPartHandler';
import { ClientQuitHandler } from './Commands/CoreCommands/ClientQuitHandler';
import { ModeCommandHandler } from './Commands/CoreCommands/ModeCommandHandler';
import { NamesHandler } from './Commands/CoreCommands/NamesHandler';
import { NickChangeHandler } from './Commands/CoreCommands/NickChangeHandler';
import { NoticeHandler } from './Commands/CoreCommands/NoticeHandler';
import { PingHandler } from './Commands/CoreCommands/PingHandler';
import { PongHandler } from './Commands/CoreCommands/PongHandler';
import { PrivmsgHandler } from './Commands/CoreCommands/PrivmsgHandler';
import { TagMessageHandler } from './Commands/CoreCommands/TagMessageHandler';
import { TopicHandler } from './Commands/CoreCommands/TopicHandler';
import { UserRegistrationHandler } from './Commands/CoreCommands/UserRegistrationHandler';
import { WhoHandler } from './Commands/CoreCommands/WhoHandler';
import { WhoisHandler } from './Commands/CoreCommands/WhoisHandler';
import type { ModeHandler, ModeType } from './Modes/ModeHandler';
import type { Module } from './Modules/Module';
import { HookResult } from './Modules/Module';
import type { ChannelCreateFlags, ModuleHook, ModuleHookTypes } from './Modules/ModuleHook';
import type { OperLogin } from './OperLogin';
import type { SendResponseCallback } from './SendResponseCallback';
import { joinChunks, matchesWildcard } from './Toolkit/StringTools';
import { assertNever } from './Toolkit/TypeTools';
import { User } from './User';

export type CaseMapping = 'ascii' | 'rfc1459' | 'rfc1459-strict';

export interface ServerConfiguration {
	serverAddress: string;
	networkName?: string;
	version?: string;
	caseMapping?: CaseMapping;
	channelLimit?: number;
	channelLength?: number;
	nickLength?: number;
	topicLength?: number;
	userLength?: number;
}

export interface InternalAccessLevelDefinition extends AccessLevelDefinition {
	name: string;
	minLevelToSet: string;
}

export class Server {
	private readonly _serverAddress: string;
	private readonly _networkName: string;
	private readonly _version: string;
	private readonly _caseMapping: CaseMapping;
	private readonly _channelLimit: number;
	private readonly _channelLength: number;
	private readonly _nickLength: number;
	private readonly _topicLength: number;
	private readonly _userLength: number;

	private readonly _users = new Set<User>();
	private readonly _nickUserMap = new Map<string, User>();
	private readonly _channels = new Map<string, Channel>();
	private readonly _knownCommands = MessageTypes.all;
	private readonly _commandHandlers = new Map<string, CommandHandler>();
	private readonly _capabilities = new Map<string, Capability>();

	private readonly _operLogins: OperLogin[] = [];

	private readonly _netServer = net.createServer(async socket => await this.initClientConnection(socket));
	private readonly _startupTime = new Date();

	private readonly _hooksByType = new Map(
		(
			[
				'channelCreate',
				'afterChannelCreate',
				'channelJoin',
				'channelMessage',
				'channelNotice',
				'channelTagMessage',
				'modeChange',
				'preTopicChange',
				'userCreate',
				'userDestroy',
				'channelCheckVisibility'
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
		this._networkName = config.networkName ?? config.serverAddress;
		this._version = config.version ?? 'node-ircv3-server-0.0.1';
		this._caseMapping = config.caseMapping ?? 'ascii';
		this._channelLimit = config.channelLimit ?? 50;
		this._channelLength = config.channelLength ?? 32;
		this._nickLength = config.nickLength ?? 31;
		this._topicLength = config.topicLength ?? 390;
		this._userLength = config.userLength ?? 12;

		this.addCapability(CoreCapabilities.MessageTags);
		this.addCapability(CoreCapabilities.Batch);
		this.addCapability(CoreCapabilities.LabeledResponse);
		this.addCapability(CoreCapabilities.CapNotify);
		this.addCapability(CoreCapabilities.AwayNotify);

		this.addCommand(new CapabilityNegotiationHandler());
		this.addCommand(new UserRegistrationHandler());
		this.addCommand(new NickChangeHandler());
		this.addCommand(new ClientQuitHandler());
		this.addCommand(new PingHandler());
		this.addCommand(new PongHandler());
		this.addCommand(new PrivmsgHandler());
		this.addCommand(new NoticeHandler());
		this.addCommand(new ModeCommandHandler());
		this.addCommand(new ChannelJoinHandler());
		this.addCommand(new ChannelPartHandler());
		this.addCommand(new NamesHandler());
		this.addCommand(new TagMessageHandler());
		this.addCommand(new TopicHandler());
		this.addCommand(new ChannelKickHandler());
		this.addCommand(new AwayHandler());
		this.addCommand(new WhoHandler());
		this.addCommand(new WhoisHandler());
	}

	addOperLogin(login: OperLogin): void {
		this._operLogins.push(login);
	}

	loginAsOper(userName: string, password: string): OperLogin | null {
		return this._operLogins.find(l => l.userName === userName && l.password === password) ?? null;
	}

	get users(): Set<User> {
		return new Set(this._users);
	}

	get channels(): Map<string, Channel> {
		return new Map(this._channels);
	}

	get supportedChannelModes(): SupportedModesByType {
		const modes = Array.from(this._registeredModes).filter(mode => mode.type === 'channel');

		const listModes: string[] = [];
		const alwaysWithParamModes = [];
		const paramWhenSetModes = [];
		const noParamModes = [];

		for (const mode of modes) {
			switch (mode.paramSpec) {
				case 'always': {
					alwaysWithParamModes.push(mode.letter);
					break;
				}
				case 'setOnly': {
					paramWhenSetModes.push(mode.letter);
					break;
				}
				case 'never': {
					noParamModes.push(mode.letter);
					break;
				}
				default: {
					assertNever(mode.paramSpec);
				}
			}
		}

		return {
			prefix: this._prefixes.reduceRight((result, prefix) => result + prefix.modeChar, ''),
			list: listModes.sort().join(''),
			alwaysWithParam: alwaysWithParamModes.sort().join(''),
			paramWhenSet: paramWhenSetModes.sort().join(''),
			noParam: noParamModes.sort().join('')
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

	get topicLength(): number {
		return this._topicLength;
	}

	get userLength(): number {
		return this._userLength;
	}

	get channelLength(): number {
		return this._channelLength;
	}

	get channelLimit(): number {
		return this._channelLimit;
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

	get availablePrefixLetters(): string {
		return this._prefixes.map(pref => pref.modeChar).join('');
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

	get serverProperties(): ServerProperties {
		return {
			supportedUserModes: this.supportedUserModes,
			supportedChannelModes: this.supportedChannelModes,
			channelTypes: '#',
			prefixes: this._prefixes
		};
	}

	async initClientConnection(socket: net.Socket): Promise<void> {
		const user = new User(this, socket);
		user.onLine(line => {
			const cmd = parseMessage(line, this.serverProperties, this._knownCommands, false, [], false);
			user.sendResponse(cmd, respond => {
				try {
					if (this._commandHandlers.has(cmd.command)) {
						cmd.parseParams();
						const handler = this._commandHandlers.get(cmd.command)!;
						handler.checkAndHandleCommand(cmd, user, this, respond);
					} else {
						respond(MessageTypes.Numerics.Error421UnknownCommand, {
							originalCommand: cmd.command,
							suffix: 'Unknown command'
						});
					}
				} catch (e) {
					if (e instanceof NotEnoughParametersError) {
						if (e.command === 'NICK' || e.command === 'WHOIS') {
							respond(MessageTypes.Numerics.Error431NoNickNameGiven, {
								suffix: 'No nick name given'
							});
						} else {
							respond(MessageTypes.Numerics.Error461NeedMoreParams, {
								originalCommand: e.command,
								suffix: 'Not enough parameters'
							});
						}
					} else if (e instanceof ParameterRequirementMismatchError) {
						if (e.paramSpec.type === 'channel' || e.paramSpec.type === 'channelList') {
							respond(MessageTypes.Numerics.Error403NoSuchChannel, {
								channel: e.givenValue,
								suffix: 'No such channel'
							});
							return;
						}
						console.error(`Error processing command (parameter mismatch): "${line}"`);
						console.error(e);
					} else {
						console.error(`Error processing command (unknown error): "${line}"`);
						console.error(e);
					}
				}
			});
		});
		user.onRegister(() => {
			this._nickUserMap.set(this.caseFoldString(user.nick!), user);
			user.sendNumeric(MessageTypes.Numerics.Reply001Welcome, {
				welcomeText: 'the server welcomes you!'
			});
			user.sendNumeric(MessageTypes.Numerics.Reply002YourHost, {
				yourHost: `Your host is ${this._serverAddress}, running version ${this._version}`
			});
			user.sendNumeric(MessageTypes.Numerics.Reply003Created, {
				createdText: `This server was created ${this._startupTime.toISOString()}`
			});
			const channelModes = this.supportedChannelModes;
			console.log(channelModes);
			user.sendNumeric(MessageTypes.Numerics.Reply004ServerInfo, {
				serverName: this._serverAddress,
				version: this._version,
				userModes: this.supportedUserModes,
				channelModes: Object.values(channelModes).join('').split('').sort().join(''),
				channelModesWithParam: (
					channelModes.alwaysWithParam +
					channelModes.prefix +
					channelModes.paramWhenSet +
					channelModes.list
				)
					.split('')
					.sort()
					.join('')
			});
			const reversedPrefixes = [...this._prefixes].reverse();
			const prefixString = `(${reversedPrefixes.map(pref => pref.modeChar).join('')})${reversedPrefixes
				.map(pref => pref.prefix)
				.join('')}`;
			const chanModesString = `${channelModes.list},${channelModes.alwaysWithParam},${channelModes.paramWhenSet},${channelModes.noParam}`;
			this.sendSupportTokens(user, [
				['CHANTYPES', '#'],
				['CHANLIMIT', `#:${this._channelLimit}`],
				['CHANNELLEN', this._channelLength.toString()],
				['NICKLEN', this._nickLength.toString()],
				['NETWORK', this._networkName],
				['CHANMODES', chanModesString],
				['PREFIX', prefixString],
				['CASEMAPPING', this._caseMapping],
				['USERLEN', this._userLength.toString()],
				['TOPICLEN', this._topicLength.toString()]
			]);
			if (user.modesAsString) {
				user.sendNumeric(MessageTypes.Numerics.Reply221UmodeIs, {
					modes: user.modesAsString
				});
			}
			this.sendMotd(user);
		});
		user.onNickChange(oldNick => {
			const newNickCaseFolded = this.caseFoldString(user.nick!);
			if (!oldNick) {
				this._nickUserMap.set(newNickCaseFolded, user);
				return;
			}
			const oldNickCaseFolded = this.caseFoldString(oldNick);
			if (newNickCaseFolded !== oldNickCaseFolded) {
				this._nickUserMap.delete(oldNickCaseFolded);
				this._nickUserMap.set(newNickCaseFolded, user);
			}
		});
		this._users.add(user);
		await user.resolveUserIp();
	}

	sendMotd(user: User): void {
		user.sendNumeric(MessageTypes.Numerics.Error422NoMotd, {
			suffix: 'MOTD File is missing'
		});
	}

	sendSupportTokens(user: User, tokens: Array<[string, string]>): void {
		// An IRC line can have 510 characters, excluding the trailing CRLF.
		// From that we subtract the following fixed characters:
		// :<serveraddr> 005 <username> <tokens> :are supported by this server
		// ^            ^   ^          ^        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
		// to get 510 - 34 = 476 available characters.
		// The things that are still missing are the length of the numeric and the <serveraddr> and <username> placeholders.
		// After subtracting these, we have the maximum length the tokens can have.
		const limit =
			476 -
			this._serverAddress.length -
			MessageTypes.Numerics.Reply005Isupport.COMMAND.length -
			user.connectionIdentifier.length;

		const lines = joinChunks(
			tokens.map(([name, value]) => `${name}=${value}`),
			limit
		);
		for (const supports of lines) {
			user.sendNumeric(MessageTypes.Numerics.Reply005Isupport, {
				supports,
				suffix: 'are supported by this server'
			});
		}
	}

	doJoinChannel(user: User, channel: Channel, creating: boolean, respond: SendResponseCallback): void {
		if (channel.containsUser(user)) {
			return;
		}

		user.addChannel(channel);
		channel.addUser(user, creating);

		channel.broadcastMessage(
			MessageTypes.Commands.ChannelJoin,
			{
				channel: channel.name
			},
			user.prefix,
			undefined,
			user
		);

		respond(
			MessageTypes.Commands.ChannelJoin,
			{
				channel: channel.name
			},
			user.prefix
		);

		channel.sendTopic(user, respond, false);
		channel.sendNames(user, respond);
	}

	doCreateChannel(user: User, channelName: string, respond: SendResponseCallback): Channel {
		// avoid creating a channel that already exists at ALL costs! even if it means checking existence more than once
		const foldedChannelName = this.caseFoldString(channelName);
		if (this._channels.has(foldedChannelName)) {
			throw new Error('trying to force creating a channel that already exists');
		}

		const channel = new Channel(channelName, user, this);

		this._channels.set(foldedChannelName, channel);

		this.doJoinChannel(user, channel, true, respond);

		const channelCreateFlags: ChannelCreateFlags = {
			modesToSet: []
		};
		this.callHook('afterChannelCreate', channel, user, channelCreateFlags);

		if (channelCreateFlags.modesToSet.length) {
			let letters = '';
			const params: string[] = [];
			for (const mode of channelCreateFlags.modesToSet) {
				channel.addMode(mode.mode, mode.param);
				letters += mode.mode.letter;
			}

			respond(MessageTypes.Commands.Mode, {
				target: channel.name,
				modes: [`+${letters}`, ...params].join(' ')
			});
		}

		return channel;
	}

	partChannel(user: User, channel: string | Channel, respond: SendResponseCallback, reason?: string): void {
		if (typeof channel === 'string') {
			const channelObject = this.getChannelByName(channel);
			if (!channelObject) {
				respond(MessageTypes.Numerics.Error403NoSuchChannel, {
					channel,
					suffix: 'No such channel'
				});
				return;
			}
			channel = channelObject;
		}

		if (!channel.users.has(user)) {
			respond(MessageTypes.Numerics.Error442NotOnChannel, {
				channel: channel.name,
				suffix: "You're not on that channel"
			});
		}

		respond(
			MessageTypes.Commands.ChannelPart,
			{
				channel: channel.name,
				reason
			},
			user.prefix
		);

		channel.broadcastMessage(
			MessageTypes.Commands.ChannelPart,
			{
				channel: channel.name,
				reason
			},
			user.prefix,
			undefined,
			user
		);

		this.unlinkUserFromChannel(user, channel);
	}

	nickExists(nick: string): boolean {
		return this._nickUserMap.has(this.caseFoldString(nick));
	}

	nickChangeAllowed(oldNick: string | undefined, newNick: string): boolean {
		if (oldNick && this.caseFoldString(oldNick) === this.caseFoldString(newNick)) {
			return true;
		}
		return !this.nickExists(newNick);
	}

	getUserByNick(nick: string): User | null {
		return this._nickUserMap.get(this.caseFoldString(nick)) ?? null;
	}

	nickMatchesWildcard(nick: string, wildcard: string): boolean {
		return matchesWildcard(this.caseFoldString(nick), this.caseFoldString(wildcard));
	}

	getChannelByName(name: string): Channel | null {
		return this._channels.get(this.caseFoldString(name)) ?? null;
	}

	killUser(user: User, reason?: string, sender?: string): void {
		const quitMessage = `Killed (${sender ?? this._serverAddress} (${reason ?? 'no reason'}))`;
		user.sendMessage(MessageTypes.Commands.ErrorMessage, {
			content: `Closing Link: ${this._serverAddress} (${quitMessage})`
		});
		this.quitUser(user, quitMessage);
	}

	quitUser(user: User, message = 'Quit'): void {
		if (!user.destroy()) {
			return;
		}
		if (user.isRegistered) {
			this.forEachCommonChannelUser(user, commonUser =>
				commonUser.sendMessage(
					MessageTypes.Commands.ClientQuit,
					{
						message
					},
					user.prefix
				)
			);
			for (const channel of user.channels) {
				this.unlinkUserFromChannel(user, channel);
			}
			if (user.nick) {
				this._nickUserMap.delete(this.caseFoldString(user.nick));
			}
		}
		this._users.delete(user);
		console.log(`${user.connectionIdentifier} disconnected. ${this._users.size} remaining.`);
	}

	unlinkUserFromChannel(user: User, channel: Channel): void {
		// can happen on multiple occasions - part, kick, quit
		user.removeChannel(channel);
		channel.removeUser(user);
	}

	destroyChannel(channel: Channel): void {
		// usually, this should only happen when a channel is empty, but we kick everyone just in case
		for (const user of channel.users) {
			user.sendMessage(MessageTypes.Commands.ChannelKick, {
				// people in channels should have a nick
				target: user.nick!,
				channel: channel.name,
				comment: 'Channel is being destroyed'
			});
			this.unlinkUserFromChannel(user, channel);
		}

		this._channels.delete(this.caseFoldString(channel.name));
	}

	createMessage<T extends Message>(
		type: MessageConstructor<T>,
		params: MessageParamValues<T>,
		prefix: MessagePrefix = this.serverPrefix
	): T {
		return createMessage(type, params, prefix, undefined, undefined, true);
	}

	forEachCommonChannelUser(user: User, cb: (commonUser: User) => void): void {
		const commonUsers = new Set<User>();

		for (const channel of user.channels) {
			for (const commonUser of channel.users) {
				if (commonUser !== user) {
					commonUsers.add(commonUser);
				}
			}
		}

		for (const commonUser of commonUsers) {
			cb(commonUser);
		}
	}

	findModeByLetter(letter: string, type: ModeType): ModeHandler | undefined {
		return Array.from(this._registeredModes).find(mode => mode.type === type && mode.letter === letter);
	}

	findModeByName(name: string, type: ModeType): ModeHandler | undefined {
		return Array.from(this._registeredModes).find(mode => mode.type === type && mode.name === name);
	}

	get capabilityNames(): string[] {
		return Array.from(this._capabilities.keys());
	}

	getCapabilityByName(name: string): Capability | null {
		return this._capabilities.get(name) ?? null;
	}

	addCapability(capability: Capability): void {
		// TODO removeCapability
		this._capabilities.set(capability.name, capability);
		if (capability.messageTypes) {
			for (const cmd of capability.messageTypes) {
				this._knownCommands.set(cmd.COMMAND, cmd);
			}
		}
		for (const user of this._users) {
			if ((user.capabilityNegotiationVersion ?? 0) >= 302 || user.hasCapability(CoreCapabilities.CapNotify)) {
				user.sendMessage(MessageTypes.Commands.CapabilityNegotiation, {
					target: user.connectionIdentifier,
					subCommand: 'NEW',
					capabilities: capability.name
				});
			}
		}
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
		if (this._commandHandlers.has(command.command)) {
			return false;
		}
		this._commandHandlers.set(command.command, command);
		return true;
	}

	removeCommand(command: CommandHandler): void {
		this._commandHandlers.delete(command.command);
	}

	callHook<HookType extends keyof ModuleHookTypes>(
		name: HookType,
		...args: Parameters<ModuleHookTypes[HookType]>
	): HookResult {
		const hooks = this._hooksByType.get(name)!;
		let result = HookResult.NEXT;

		for (const hook of hooks) {
			result = (hook as ModuleHook<HookType>).call(...args);

			if (result !== HookResult.NEXT) {
				break;
			}
		}

		return result;
	}

	getRedirectableClientTags(cmd: Message): Map<string, string> {
		return new Map<string, string>(Array.from(cmd.tags.entries()).filter(([key]) => key.startsWith('+')));
	}

	caseFoldString(str: string): string {
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
