import User from './User';
import { MessageConstructor, MessagePrefix, MessageTypes, SingleMode, prefixToString } from 'ircv3';
import { ModeState } from './Toolkit/ModeTools';
import Server from './Server';
import { ConstructedType, MessageParams } from 'ircv3/lib/Toolkit/TypeTools';
import { sortStringByOrder } from './Toolkit/StringTools';
import ModeHolder from './Modes/ModeHolder';
import ModeHandler from './Modes/ModeHandler';

export default class Channel implements ModeHolder {
	private _modes: ModeState[] = [];
	private _topic = '';
	private _topicTime = 0;
	private _topicSetter = '';
	private _userAccess = new Map<User, string>();

	constructor(private readonly _name: string, creator: User, private readonly _server: Server) {
		_server.callHook('onChannelCreate', this, creator);
	}

	addUser(user: User, isFirst: boolean = false) {
		this._userAccess.set(user, isFirst ? 'o' : '');
	}

	removeUser(user: User) {
		this._userAccess.delete(user);

		if (!this._userAccess.size) {
			this._server.destroyChannel(this);
		}
	}

	containsUser(user: User) {
		return this._userAccess.has(user);
	}

	addMode(mode: ModeHandler, param?: string) {
		this._modes.push({ mode, param });
	}

	get name() {
		return this._name;
	}

	get users() {
		return new Set<User>(this._userAccess.keys());
	}

	get modes() {
		return this._modes;
	}

	get modesAsString() {
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

	static stateSorter(a: ModeState, b: ModeState) {
		return a.mode.letter.localeCompare(b.mode.letter) || (a.param && b.param ? a.param.localeCompare(b.param) : 0);
	}

	static actionSorter(a: SingleMode, b: SingleMode) {
		return a.action.localeCompare(b.action) || a.letter.localeCompare(b.letter) || (a.param && b.param ? a.param.localeCompare(b.param) : 0);
	}

	processModes(changes: SingleMode[], source: User) {
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
					source.sendNumericReply(MessageTypes.Numerics.Error482ChanOPrivsNeeded, {
						channel: this._name,
						suffix: 'You need channel privileges to do this'
					});
					continue;
				}
			} else if (!modeDescriptor.canSetOn(this, source, this._server, adding, mode.param)) {
				source.sendNumericReply(MessageTypes.Numerics.Error482ChanOPrivsNeeded, {
					channel: this._name,
					suffix: 'You need channel privileges to do this'
				});
				continue;
			}
			if (adding) {
				if (isPrefix) {
					const user = this._server.getUserByNick(mode.param!);
					if (!user) {
						source.sendNumericReply(MessageTypes.Numerics.Error401NoSuchNick, {
							nick: mode.param,
							suffix: 'No such nick'
						});
						continue;
					}

					const removalIndex = filteredChanges.findIndex(change => change.letter === mode.letter && change.param === mode.param && change.action === 'remove');
					if (removalIndex !== -1) {
						filteredChanges.splice(removalIndex, 1);
					} else if (this._userAccess.get(user)!.includes(mode.letter)) {
						continue;
					} else {
						filteredChanges.push(mode);
					}
					resultingAccess.set(user, sortStringByOrder(`${(resultingAccess.get(user) || this._userAccess.get(user) || '')}${mode.letter}`, this._server.supportedChannelModes.prefix));
				} else if (this._server.supportedChannelModes.list.includes(mode.letter)) {
					// TODO, just ignore for now
				} else {
					const removalIndex = filteredChanges.findIndex(change => change.letter === mode.letter && change.param === mode.param && change.action === 'remove');
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
					const user = this._server.getUserByNick(mode.param!);
					if (!user) {
						source.sendNumericReply(MessageTypes.Numerics.Error401NoSuchNick, {
							nick: mode.param,
							suffix: 'No such nick'
						});
						continue;
					}

					const addIndex = filteredChanges.findIndex(change => change.letter === mode.letter && change.param === mode.param && change.action === 'add');
					if (addIndex !== -1) {
						filteredChanges.splice(addIndex, 1);
					} else if (!this._userAccess.get(user)!.includes(mode.letter)) {
						continue;
					} else {
						filteredChanges.push(mode);
					}

					resultingAccess.set(user, (resultingAccess.get(user) || this._userAccess.get(user) || '').replace(mode.letter, ''));
				} else if (this._server.supportedChannelModes.list.includes(mode.letter)) {
					// TODO, just ignore for now
				} else {
					const ignoreParam = this._server.supportedChannelModes.paramWhenSet.includes(mode.letter);
					const addIndex = filteredChanges.findIndex(change => change.letter === mode.letter && (ignoreParam || change.param === mode.param) && change.action === 'add');
					if (addIndex !== -1) {
						filteredChanges.splice(addIndex, 1);
					} else if (!this._modes.find(currentMode => currentMode.mode.letter === mode.letter)) {
						continue;
					} else {
						filteredChanges.push(mode);
					}

					const setModeIndex = resultingModes.findIndex(currMode => currMode.mode.letter === mode.letter && (ignoreParam || currMode.param === mode.param));

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
		// tslint:disable-next-line:
		this._modes = resultingModes.sort(Channel.stateSorter);
		this._userAccess = resultingAccess;

		this.broadcastMessage(MessageTypes.Commands.Mode, {
			target: this._name,
			modes: filteredChanges.sort(Channel.actionSorter).reduce((result, action) => {
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
			}, ['']).join(' ')
		}, source.prefix);
	}

	sendNames(user: User) {
		user.sendNumericReply(MessageTypes.Numerics.Reply353NamesReply, {
			channelType: '=',
			channel: this.name,
			names: this.getPrefixedNicks(true).join(' ')
		});
		user.sendNumericReply(MessageTypes.Numerics.Reply366EndOfNames, {
			channel: this.name,
			suffix: 'End of /NAMES list'
		});
	}

	sendTopic(user: User, sendNoTopic: boolean = true) {
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

	changeTopic(newTopic: string, user: User, ts: number = Date.now()) {
		this._topic = newTopic;
		this._topicTime = ts;
		this._topicSetter = prefixToString(user.prefix);

		this.broadcastMessage(MessageTypes.Commands.Topic, {
			channel: this.name,
			newTopic: newTopic
		}, user.prefix);
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
		return `${prefixSymbols}${nick}`;
	}

	hasModeSet(mode: ModeHandler) {
		return !!this._modes.find(setMode => setMode.mode === mode);
	}

	getPrefixDefinitionForUser(user: User, setOfAccessLevels: Map<User, string> = this._userAccess) {
		const userAccess = setOfAccessLevels.get(user);
		if (!userAccess) {
			return false;
		}
		return this._server.getPrefixDefinitionByModeChar(userAccess[0]);
	}

	isUserAtLeast(user: User, accessLevelName: string, setOfAccessLevels: Map<User, string> = this._userAccess) {
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

	getPrefixedNicks(allPrefixes: boolean) {
		return Array.from(this._userAccess.entries()).map(([user, prefixes]) => this._prefixNick(user.nick!, prefixes, allPrefixes));
	}

	broadcastMessage<T extends MessageConstructor>(type: T, params: MessageParams<ConstructedType<T>>, prefix: MessagePrefix, exceptUser?: User) {
		for (const user of this.users) {
			if (user !== exceptUser) {
				user.sendMessage(type, params, prefix);
			}
		}
	}
}
