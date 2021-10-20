import type { Message, SingleMode } from 'ircv3';
import { MessageTypes, prefixToString } from 'ircv3';
import type { ModeHandler } from './Modes/ModeHandler';
import type { ModeHolder } from './Modes/ModeHolder';
import type { InternalAccessLevelDefinition, Server } from './Server';
import type { ModeState } from './Toolkit/ModeTools';
import { sortStringByOrder } from './Toolkit/StringTools';
import type { User } from './User';

export class Channel implements ModeHolder {
	private _modes: ModeState[] = [];
	private _topic = '';
	private _topicTime = 0;
	private _topicSetter = '';
	private _userAccess = new Map<User, string>();

	static stateSorter = (a: ModeState, b: ModeState): number =>
		a.mode.letter.localeCompare(b.mode.letter) || (a.param && b.param ? a.param.localeCompare(b.param) : 0);

	static actionSorter = (a: SingleMode, b: SingleMode): number =>
		a.action.localeCompare(b.action) ||
		a.letter.localeCompare(b.letter) ||
		(a.param && b.param ? a.param.localeCompare(b.param) : 0);

	constructor(private readonly _name: string, creator: User, private readonly _server: Server) {
		_server.callHook('channelCreate', this, creator);
	}

	addUser(user: User, isFirst: boolean = false): void {
		this._userAccess.set(user, isFirst ? 'o' : '');
	}

	removeUser(user: User): void {
		this._userAccess.delete(user);

		if (!this._userAccess.size) {
			this._server.destroyChannel(this);
		}
	}

	containsUser(user: User): boolean {
		return this._userAccess.has(user);
	}

	addMode(mode: ModeHandler, param?: string): void {
		this._modes.push({ mode, param });
	}

	get name(): string {
		return this._name;
	}

	get users(): Set<User> {
		return new Set<User>(this._userAccess.keys());
	}

	get modes(): ModeState[] {
		return this._modes;
	}

	get modesAsString(): string {
		let letters = '+';
		const params = [];
		for (const ms of this._modes) {
			letters += ms.mode.letter;
			if (ms.param) {
				params.push(ms.param);
			}
		}
		return [letters, ...params].join(' ');
	}

	processModes(changes: SingleMode[], source: User): void {
		const resultingModes = this._modes.slice();
		const resultingAccess = new Map<User, string>(this._userAccess);
		const filteredChanges: SingleMode[] = [];
		for (const mode of changes) {
			const modeDescriptor = this._server.findMode(mode.letter, 'channel')!;
			const adding = mode.action === 'add';
			const isPrefix = this._server.supportedChannelModes.prefix.includes(mode.letter);
			if (isPrefix) {
				const foundPrefix = this._server.getPrefixDefinitionByModeChar(mode.letter);
				if (!foundPrefix || !this.isUserAtLeast(source, foundPrefix.minLevelToSet, resultingAccess)) {
					source.sendNumericReply(MessageTypes.Numerics.Error482ChanOpPrivsNeeded, {
						channel: this._name,
						suffix: 'You need channel privileges to do this'
					});
					continue;
				}
			} else if (!modeDescriptor.canSetOn(this, source, this._server, adding, mode.param)) {
				source.sendNumericReply(MessageTypes.Numerics.Error482ChanOpPrivsNeeded, {
					channel: this._name,
					suffix: 'You need channel privileges to do this'
				});
				continue;
			}
			if (adding) {
				if (isPrefix) {
					const userNick = mode.param!;
					const user = this._server.getUserByNick(userNick);
					if (!user) {
						source.sendNumericReply(MessageTypes.Numerics.Error401NoSuchNick, {
							nick: userNick,
							suffix: 'No such nick'
						});
						continue;
					}

					const removalIndex = filteredChanges.findIndex(
						change =>
							change.letter === mode.letter && change.param === userNick && change.action === 'remove'
					);
					if (removalIndex !== -1) {
						filteredChanges.splice(removalIndex, 1);
					} else if (this._userAccess.get(user)!.includes(mode.letter)) {
						continue;
					} else {
						filteredChanges.push(mode);
					}
					resultingAccess.set(
						user,
						sortStringByOrder(
							`${resultingAccess.get(user) ?? this._userAccess.get(user) ?? ''}${mode.letter}`,
							this._server.supportedChannelModes.prefix
						)
					);
				} else if (this._server.supportedChannelModes.list.includes(mode.letter)) {
					// TODO, just ignore for now
				} else {
					const removalIndex = filteredChanges.findIndex(
						change =>
							change.letter === mode.letter && change.param === mode.param && change.action === 'remove'
					);
					if (removalIndex !== -1) {
						filteredChanges.splice(removalIndex, 1);
					} else if (this._modes.find(currentMode => currentMode.mode.letter === mode.letter)) {
						continue;
					} else {
						filteredChanges.push(mode);
					}
					resultingModes.push({
						mode: modeDescriptor,
						param: mode.param
					});
				}
			} else if (mode.action === 'remove') {
				if (isPrefix) {
					const userNick = mode.param!;
					const user = this._server.getUserByNick(userNick);
					if (!user) {
						source.sendNumericReply(MessageTypes.Numerics.Error401NoSuchNick, {
							nick: userNick,
							suffix: 'No such nick'
						});
						continue;
					}

					const addIndex = filteredChanges.findIndex(
						change => change.letter === mode.letter && change.param === userNick && change.action === 'add'
					);
					if (addIndex !== -1) {
						filteredChanges.splice(addIndex, 1);
					} else if (this._userAccess.get(user)!.includes(mode.letter)) {
						filteredChanges.push(mode);
					} else {
						continue;
					}

					resultingAccess.set(
						user,
						(resultingAccess.get(user) ?? this._userAccess.get(user) ?? '').replace(mode.letter, '')
					);
				} else if (this._server.supportedChannelModes.list.includes(mode.letter)) {
					// TODO, just ignore for now
				} else {
					const ignoreParam = this._server.supportedChannelModes.paramWhenSet.includes(mode.letter);
					const addIndex = filteredChanges.findIndex(
						change =>
							change.letter === mode.letter &&
							(ignoreParam || change.param === mode.param) &&
							change.action === 'add'
					);
					if (addIndex !== -1) {
						filteredChanges.splice(addIndex, 1);
					} else if (this._modes.find(currentMode => currentMode.mode.letter === mode.letter)) {
						filteredChanges.push(mode);
					} else {
						continue;
					}

					const setModeIndex = resultingModes.findIndex(
						currMode =>
							currMode.mode.letter === mode.letter && (ignoreParam || currMode.param === mode.param)
					);

					if (setModeIndex !== -1) {
						resultingModes.splice(setModeIndex, 1);
					}
				}
			}
		}

		if (filteredChanges.length === 0) {
			return;
		}

		// normalize (sort) modes
		this._modes = resultingModes.sort(Channel.stateSorter);
		this._userAccess = resultingAccess;

		this.broadcastMessage(
			this._server.createMessage(
				MessageTypes.Commands.Mode,
				{
					target: this._name,
					modes: filteredChanges
						.sort(Channel.actionSorter)
						.reduce(
							(result, action) => {
								let [letters, ...params] = result;
								if (action.action === 'remove') {
									if (!letters.includes('-')) {
										letters += '-';
									}
								} else if (letters.length === 0) {
									letters += '+';
								}

								letters += action.letter;

								if (action.param === undefined) {
									return [letters, ...params];
								} else {
									return [letters, ...params, action.param];
								}
							},
							['']
						)
						.join(' ')
				},
				source.prefix
			)
		);
	}

	sendNames(user: User): void {
		// TODO only set allPrefixes to true if indicated by the user
		const prefixedNicks = this._userAccess.has(user)
			? this.getPrefixedNicks(true)
			: this.getPrefixedNicks(true, u => !u.hasMode('i'));
		user.sendNumericReply(MessageTypes.Numerics.Reply353NamesReply, {
			channelType: '=',
			channel: this.name,
			names: prefixedNicks.join(' ')
		});
		user.sendNumericReply(MessageTypes.Numerics.Reply366EndOfNames, {
			channel: this.name,
			suffix: 'End of /NAMES list'
		});
	}

	sendTopic(user: User, sendNoTopic: boolean = true): void {
		if (this.topic) {
			user.sendNumericReply(MessageTypes.Numerics.Reply332Topic, {
				channel: this.name,
				topic: this.topic
			});
			user.sendNumericReply(MessageTypes.Numerics.Reply333TopicWhoTime, {
				channel: this.name,
				who: this._topicSetter,
				ts: (this._topicTime / 1000).toString()
			});
		} else if (sendNoTopic) {
			user.sendNumericReply(MessageTypes.Numerics.Reply331NoTopic, {
				channel: this.name,
				suffix: 'No topic is set'
			});
		}
	}

	get topic(): string {
		return this._topic;
	}

	changeTopic(newTopic: string, user: User, ts: number = Date.now()): void {
		this._topic = newTopic;
		this._topicTime = ts;
		this._topicSetter = prefixToString(user.prefix);

		this.broadcastMessage(
			this._server.createMessage(
				MessageTypes.Commands.Topic,
				{
					channel: this.name,
					newTopic: newTopic
				},
				user.prefix
			)
		);
	}

	hasModeSet(mode: ModeHandler): boolean {
		return !!this._modes.find(setMode => setMode.mode === mode);
	}

	getPrefixDefinitionForUser(
		user: User,
		setOfAccessLevels: Map<User, string> = this._userAccess
	): InternalAccessLevelDefinition | null {
		const userAccess = setOfAccessLevels.get(user);
		if (!userAccess) {
			return null;
		}
		return this._server.getPrefixDefinitionByModeChar(userAccess[0]);
	}

	isUserAtLeast(
		user: User,
		accessLevelName: string,
		setOfAccessLevels: Map<User, string> = this._userAccess
	): boolean {
		const necessaryAccess = this._server.getAccessLevelByName(accessLevelName);
		if (necessaryAccess === -1) {
			throw new TypeError(`Prefix '${accessLevelName}' is not defined in the server`);
		}
		const userAccess = setOfAccessLevels.get(user);
		if (!userAccess) {
			return false;
		}
		const highestAccess = this._server.getAccessLevelByModeChar(userAccess[0]);

		return highestAccess >= necessaryAccess;
	}

	getPrefixedNicks(allPrefixes: boolean, userFilter?: (u: User) => boolean): string[] {
		let entries = Array.from(this._userAccess.entries());
		if (userFilter) {
			entries = entries.filter(([u]) => userFilter(u));
		}
		return entries.map(([user, prefixes]) => this._prefixNick(user.nick!, prefixes, allPrefixes));
	}

	broadcastMessage(msg: Message, exceptUser?: User): void {
		for (const user of this.users) {
			if (user !== exceptUser) {
				user.sendMessage(msg);
			}
		}
	}

	private _prefixNick(nick: string, prefixes: string, all: boolean) {
		if (!prefixes) {
			return nick;
		}

		if (!all) {
			prefixes = prefixes[0];
		}
		const prefixSymbols = prefixes.split('').map(mode => {
			const level = this._server.getPrefixDefinitionByModeChar(mode);
			return level ? level.prefix : '';
		});
		return `${prefixSymbols.join('')}${nick}`;
	}
}
