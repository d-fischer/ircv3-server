import type { Message, MessageConstructor, MessageParamValues, MessagePrefix, SingleMode } from 'ircv3';
import { MessageTypes, prefixToString } from 'ircv3';
import { MetadataHolder } from './MetadataHolder';
import type { ListChangeHandler } from './Modes/Channel/ListChannelModeHandler';
import { ListChannelModeHandler } from './Modes/Channel/ListChannelModeHandler';
import type { ModeHandler } from './Modes/ModeHandler';
import type { ModeHolder } from './Modes/ModeHolder';
import type { SendableMessageProperties } from './SendableMessageProperties';
import type { SendResponseCallback } from './SendResponseCallback';
import type { InternalAccessLevelDefinition, Server } from './Server';
import type { ModeState } from './Toolkit/ModeTools';
import { sortStringByOrder } from './Toolkit/StringTools';
import type { User } from './User';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ChannelMetadata {}

export class Channel extends MetadataHolder<ChannelMetadata> implements ModeHolder {
	private _modes: ModeState[] = [];
	private _topic = '';
	private _topicTime = 0;
	private _topicSetter = '';
	private _userAccess = new Map<User, string>();

	static stateSorter = (a: ModeState, b: ModeState): number =>
		a.mode.letter.localeCompare(b.mode.letter) || (a.param && b.param ? a.param.localeCompare(b.param) : 0);

	constructor(private readonly _name: string, creator: User, server: Server) {
		super(server, 'channel');
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

	get numberOfUsers(): number {
		return this._userAccess.size;
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

	processModes(changes: SingleMode[], source: User, respond: SendResponseCallback): void {
		const availablePrefixLetters = this._server.availablePrefixLetters;

		const resultingModes = this._modes.slice();
		const resultingAccess = new Map<User, string>(this._userAccess);
		const listChangeHandlers = new Map<ListChannelModeHandler, ListChangeHandler>();
		const listsSent = new Set<ListChannelModeHandler>();
		const filteredChanges: SingleMode[] = [];
		for (const mode of changes) {
			const modeDescriptor = this._server.findModeByLetter(mode.letter, 'channel')!;
			if (mode.action === 'getList') {
				if (modeDescriptor instanceof ListChannelModeHandler && !listsSent.has(modeDescriptor)) {
					listsSent.add(modeDescriptor);
					modeDescriptor.sendList(this, source, respond);
				}
				continue;
			}
			const adding = mode.action === 'add';
			const isPrefix = availablePrefixLetters.includes(mode.letter);
			if (isPrefix) {
				const foundPrefix = this._server.getPrefixDefinitionByModeChar(mode.letter);
				if (!foundPrefix || !this.isUserAtLeast(source, foundPrefix.minLevelToSet, resultingAccess)) {
					respond(MessageTypes.Numerics.Error482ChanOpPrivsNeeded, {
						channel: this._name,
						suffix: 'You need channel privileges to do this'
					});
					continue;
				}
			} else if (!modeDescriptor.checkAccess(this, source, this._server, adding, mode.param)) {
				respond(MessageTypes.Numerics.Error482ChanOpPrivsNeeded, {
					channel: this._name,
					suffix: 'You need channel privileges to do this'
				});
				continue;
			} else if (!modeDescriptor.checkValidity(this, source, this._server, adding, mode.param)) {
				continue;
			}
			if (adding) {
				if (isPrefix) {
					const userNick = mode.param!;
					const user = this._server.getUserByNick(userNick);
					if (!user?.isRegistered) {
						respond(MessageTypes.Numerics.Error401NoSuchNick, {
							nick: userNick,
							suffix: 'No such nick'
						});
						continue;
					}

					if (!this.containsUser(user)) {
						respond(MessageTypes.Numerics.Error441UserNotInChannel, {
							nick: user.nick!,
							channel: this.name,
							suffix: "They aren't on that channel"
						});
						continue;
					}

					if (resultingAccess.get(user)!.includes(mode.letter)) {
						continue;
					}
					filteredChanges.push(mode);
					resultingAccess.set(
						user,
						sortStringByOrder(`${resultingAccess.get(user)!}${mode.letter}`, availablePrefixLetters)
					);
				} else if (modeDescriptor instanceof ListChannelModeHandler) {
					// eslint-disable-next-line @typescript-eslint/init-declarations
					let changer;
					if (listChangeHandlers.has(modeDescriptor)) {
						changer = listChangeHandlers.get(modeDescriptor)!;
					} else {
						changer = modeDescriptor.change(this, this._server, source);
						listChangeHandlers.set(modeDescriptor, changer);
					}
					if (!changer.has(mode.param!)) {
						filteredChanges.push(mode);
						changer.add(mode.param!);
					}
				} else {
					if (modeDescriptor.paramSpec === 'setOnly') {
						filteredChanges.push(mode);
						const resultRemovalIndex = resultingModes.findIndex(resMode => resMode.mode === modeDescriptor);
						if (resultRemovalIndex !== -1) {
							resultingModes.splice(resultRemovalIndex, 1);
						}
						resultingModes.push({
							mode: modeDescriptor,
							param: mode.param
						});
					} else if (!resultingModes.find(currentMode => currentMode.mode === modeDescriptor)) {
						filteredChanges.push(mode);
						resultingModes.push({
							mode: modeDescriptor,
							param: mode.param
						});
					}
				}
			} else if (mode.action === 'remove') {
				if (isPrefix) {
					const userNick = mode.param!;
					const user = this._server.getUserByNick(userNick);
					if (!user?.isRegistered) {
						respond(MessageTypes.Numerics.Error401NoSuchNick, {
							nick: userNick,
							suffix: 'No such nick'
						});
						continue;
					}

					if (!this.containsUser(user)) {
						respond(MessageTypes.Numerics.Error441UserNotInChannel, {
							nick: user.nick!,
							channel: this.name,
							suffix: "They aren't on that channel"
						});
						continue;
					}

					if (!resultingAccess.get(user)!.includes(mode.letter)) {
						continue;
					}

					filteredChanges.push(mode);
					resultingAccess.set(user, resultingAccess.get(user)!.replace(mode.letter, ''));
				} else if (modeDescriptor instanceof ListChannelModeHandler) {
					// eslint-disable-next-line @typescript-eslint/init-declarations
					let changer;
					if (listChangeHandlers.has(modeDescriptor)) {
						changer = listChangeHandlers.get(modeDescriptor)!;
					} else {
						changer = modeDescriptor.change(this, this._server, source);
						listChangeHandlers.set(modeDescriptor, changer);
					}
					if (changer.has(mode.param!)) {
						filteredChanges.push(mode);
						changer.remove(mode.param!);
					}
				} else {
					if (!resultingModes.find(currentMode => currentMode.mode === modeDescriptor)) {
						continue;
					}
					filteredChanges.push(mode);

					const setModeIndex = resultingModes.findIndex(
						currMode =>
							currMode.mode === modeDescriptor &&
							(modeDescriptor.paramSpec === 'setOnly' || currMode.param === mode.param)
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

		for (const listChanges of listChangeHandlers.values()) {
			listChanges.finalize();
		}

		let currentlyAdding = true;
		const completeModeString = filteredChanges
			.reduce(
				(result, action) => {
					let [letters, ...params] = result;
					if (letters.length === 0) {
						currentlyAdding = action.action === 'add';
						letters += currentlyAdding ? '+' : '-';
					} else {
						if (action.action === 'remove') {
							if (currentlyAdding) {
								letters += '-';
								currentlyAdding = false;
							}
						} else if (!currentlyAdding) {
							letters += '+';
							currentlyAdding = true;
						}
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
			.join(' ');

		respond(
			MessageTypes.Commands.Mode,
			{
				target: this._name,
				modes: completeModeString
			},
			source.prefix
		);

		this.broadcastMessage(
			MessageTypes.Commands.Mode,
			{
				target: this._name,
				modes: completeModeString
			},
			source.prefix,
			{},
			source
		);
	}

	getModeData(mode: ModeHandler): ModeState | null {
		return this._modes.find(m => m.mode === mode) ?? null;
	}

	sendNames(user: User, respond: SendResponseCallback): void {
		// TODO only set allPrefixes to true if indicated by the user
		const prefixedNicks = this._userAccess.has(user)
			? this.getPrefixedNicks(true)
			: this.getPrefixedNicks(true, u => !u.hasMode('invisible'));
		respond(MessageTypes.Numerics.Reply353NamesReply, {
			channelType: '=',
			channel: this.name,
			names: prefixedNicks.join(' ')
		});
		respond(MessageTypes.Numerics.Reply366EndOfNames, {
			channel: this.name,
			suffix: 'End of /NAMES list'
		});
	}

	sendTopic(user: User, respond: SendResponseCallback, sendNoTopic: boolean = true): void {
		if (this.topic) {
			respond(MessageTypes.Numerics.Reply332Topic, {
				channel: this.name,
				topic: this.topic
			});
			respond(MessageTypes.Numerics.Reply333TopicWhoTime, {
				channel: this.name,
				who: this._topicSetter,
				ts: (this._topicTime / 1000).toString()
			});
		} else if (sendNoTopic) {
			respond(MessageTypes.Numerics.Reply331NoTopic, {
				channel: this.name,
				suffix: 'No topic is set'
			});
		}
	}

	get topic(): string {
		return this._topic;
	}

	changeTopic(newTopic: string, user: User, respond: SendResponseCallback, ts: number = Date.now()): void {
		this._topic = newTopic;
		this._topicTime = ts;
		this._topicSetter = prefixToString(user.prefix);

		respond(
			MessageTypes.Commands.Topic,
			{
				channel: this.name,
				newTopic: newTopic
			},
			user.prefix
		);

		this.broadcastMessage(
			MessageTypes.Commands.Topic,
			{
				channel: this.name,
				newTopic: newTopic
			},
			user.prefix,
			undefined,
			user
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

	getFilteredPrefixesForUser(user: User, modeLetters: string): string {
		return modeLetters
			.split('')
			.map(letter => {
				if (!this._userAccess.get(user)?.includes(letter)) {
					return '';
				}

				const def = this._server.getPrefixDefinitionByModeChar(letter);
				return def?.prefix ?? '';
			})
			.join('');
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

	broadcastMessage<T extends Message<T>>(
		type: MessageConstructor<T>,
		params: MessageParamValues<T>,
		prefix: MessagePrefix = this._server.serverPrefix,
		properties?: SendableMessageProperties,
		exceptUser?: User | undefined
	): void {
		for (const user of this.users) {
			if (user !== exceptUser) {
				user.sendMessage(type, params, prefix, properties);
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
