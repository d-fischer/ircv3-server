import * as net from 'net';
import { EventEmitter, Listener } from 'typed-event-emitter';
import Server from './Server';
import { Message, MessageConstructor, MessageParam, MessagePrefix, SingleMode } from 'ircv3';
import Channel from './Channel';
import { ConstructedType, MessageParams } from 'ircv3/lib/Toolkit/TypeTools';
import { Omit } from './Toolkit/TypeTools';
import { ModeState } from './Toolkit/ModeTools';
import * as MessageTypes from 'ircv3/lib/Message/MessageTypes';
import ModeHolder from './Modes/ModeHolder';
import ModeHandler from './Modes/ModeHandler';

type NickChangeResult = 'ok' | 'invalid' | 'inUse';

export default class User extends EventEmitter implements ModeHolder {
	private _nick?: string;
	private _userName?: string;
	private _realName?: string;
	private _registered: boolean = false;
	private _destroying: boolean = false;

	private _modes: ModeState[] = [];
	private readonly _channels = new Set<Channel>();

	onLine: (handler: (line: string) => void) => Listener = this.registerEvent();
	onRegister: (handler: () => void) => Listener = this.registerEvent();
	onNickChange: (handler: (oldNick?: string) => void) => Listener = this.registerEvent();

	constructor(protected _server: Server, protected _socket: net.Socket) {
		super();
		_server.callHook('onUserCreate', this);
		_socket.on('data', data => {
			for (const line of data.toString().split(/\r?\n/)) {
				if (line) {
					// tslint:disable-next-line:no-console
					console.log(`${this.connectionIdentifier} > ${line}`);
					this.emit(this.onLine, line);
				}
			}
		});
		_socket.on('close', () => this._server.destroyConnection(this));
		_socket.on('error', () => this._server.destroyConnection(this));
	}

	addMode(mode: ModeHandler) {
		this._modes.push({ mode });
	}

	private _checkNewRegistration() {
		if (!this._registered && this._nick && this._userName && this._realName) {
			this._registered = true;
			this.emit(this.onRegister);
		}
	}

	setNick(nick: string): NickChangeResult {
		if (this._server.nickExists(nick)) {
			return 'inUse';
		}
		// if nick contains an invalid char or only numbers, it fails
		if (/[^a-zA-Z0-9[\]{}|\\^_-]/.test(nick) || !/[^0-9]/.test(nick)) {
			return 'invalid';
		}
		this._nick = nick;
		if (!this._registered) {
			this._checkNewRegistration();
		}
		return 'ok';
	}

	setUserRegistration(user: string, realName: string) {
		this._realName = realName;
		this._userName = user;
		this._checkNewRegistration();
	}

	get isRegistered(): boolean {
		return this._registered;
	}

	get nick(): string | undefined {
		return this._nick;
	}

	get userName(): string | undefined {
		return this._userName;
	}

	get realName(): string | undefined {
		return this._realName;
	}

	get connectionIdentifier(): string {
		return this.isRegistered ? this.nick! : '*';
	}

	get prefix(): MessagePrefix {
		if (!this._registered) {
			throw new Error('user is not registered');
		}

		return {
			nick: this._nick!,
			user: this._userName!,
			host: 'me.com'
		};
	}

	get modes() {
		return this._modes;
	}

	get modesAsString() {
		return `+${this._modes.map(mode => mode.mode.letter).join('')}`;
	}

	ifRegistered(cb: () => void) {
		if (this.isRegistered) {
			cb();
		} else {
			this.sendNumericReply(MessageTypes.Numerics.Error451NotRegistered, {
				suffix: 'You have not registered'
			});
		}
	}

	processModes(changes: SingleMode[]) {
		const resultingModes = this._modes.slice();
		const filteredChanges: SingleMode[] = [];
		for (const mode of changes) {
			const modeDescriptor = this._server.findMode(mode.letter, 'user')!;
			const adding = mode.action === 'add';
			if (!modeDescriptor.canSetOn(this, this, this._server, adding, mode.param)) {
				// the mode itself should handle the individual error here
				continue;
			}
			if (mode.action === 'add') {
				const removalIndex = filteredChanges.findIndex(change => change.letter === mode.letter && change.action === 'remove');
				if (removalIndex !== -1) {
					filteredChanges.splice(removalIndex, 1);
				} else if (this._modes.find(currentMode => currentMode.mode.letter === mode.letter)) {
					continue;
				} else {
					filteredChanges.push(mode);
				}
				resultingModes.push({
					mode: modeDescriptor
				});
			} else if (mode.action === 'remove') {
				const addIndex = filteredChanges.findIndex(change => change.letter === mode.letter && change.action === 'add');
				if (addIndex !== -1) {
					filteredChanges.splice(addIndex, 1);
				} else if (!this._modes.find(currentMode => currentMode.mode.letter === mode.letter)) {
					continue;
				} else {
					filteredChanges.push(mode);
				}

				const setModeIndex = resultingModes.findIndex(currMode => currMode.mode.letter === mode.letter);

				if (setModeIndex !== -1) {
					resultingModes.splice(setModeIndex, 1);
				}
			}
		}

		if (filteredChanges.length === 0) {
			return;
		}

		// normalize (sort) modes
		// tslint:disable-next-line:
		this._modes = resultingModes.sort(Channel.stateSorter);

		this.sendMessage(MessageTypes.Commands.Mode, {
			target: this._nick,
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

				return [letters, ...params];
			}, ['']).join(' ')
		}, this.prefix);
	}

	addChannel(channel: Channel) {
		this._channels.add(channel);
	}

	removeChannel(channel: Channel) {
		this._channels.delete(channel);
	}

	get channels() {
		return new Set<Channel>(this._channels);
	}

	destroy() {
		if (!this._destroying) {
			this._destroying = true;
			this._socket.removeAllListeners('data');
			this._socket.destroy();
			this.removeListener();
			this._server.callHook('onUserDestroy', this);
			return true;
		}

		return false;
	}

	writeLine(str: string) {
		// tslint:disable-next-line:no-console
		console.log(`${this.connectionIdentifier} < ${str}`);
		this._socket.write(`${str}\r\n`);
	}

	sendMessage<T extends MessageConstructor>(type: T, params: MessageParams<ConstructedType<T>>, prefix: MessagePrefix = this._server.serverPrefix) {
		this.writeLine(type.create(params, prefix).toString(true));
	}

	sendNumericReply<T extends MessageConstructor<Message<{ me: MessageParam }>>>(type: T, params: Omit<MessageParams<ConstructedType<T>>, 'me'>) {
		this.writeLine(type.create({
			me: this.connectionIdentifier,
			...params
		}, this._server.serverPrefix).toString(true));
	}
}
