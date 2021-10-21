import { EventEmitter } from '@d-fischer/typed-event-emitter';
import { promises as dns, NODATA, NOTFOUND } from 'dns';
import type { Message, MessageConstructor, MessageParamValues, MessagePrefix, SingleMode } from 'ircv3';
import { createMessage, MessageTypes } from 'ircv3';
import type * as net from 'net';
import { Channel } from './Channel';
import type { ModeHandler } from './Modes/ModeHandler';
import type { ModeHolder } from './Modes/ModeHolder';
import type { Server } from './Server';
import type { ModeState } from './Toolkit/ModeTools';

type NickChangeResult = 'ok' | 'invalid' | 'inUse';

export class User extends EventEmitter implements ModeHolder {
	private _nick?: string;
	private _userName?: string;
	private _hostName: string;
	private _realName?: string;

	private _hostIpResolved: boolean | null = null;
	private _registered = false;
	private _destroying = false;

	private _modes: ModeState[] = [];
	private readonly _channels = new Set<Channel>();

	onLine = this.registerEvent<[line: string]>();
	onRegister = this.registerEvent<[]>();
	onNickChange = this.registerEvent<[oldNick?: string]>();

	constructor(protected _server: Server, protected _socket: net.Socket) {
		super();
		_server.callHook('userCreate', this);
		_socket.on('data', data => {
			for (const line of data.toString().split(/\r?\n/)) {
				if (line) {
					console.log(`${this.connectionIdentifier} > ${line}`);
					this.emit(this.onLine, line);
				}
			}
		});
		_socket.on('close', () => this._server.destroyConnection(this));
		_socket.on('error', () => this._server.destroyConnection(this));
		this._hostName = this._socket.remoteAddress!;
	}

	async resolveUserIp(): Promise<boolean> {
		if (this._hostIpResolved !== null) {
			return this._hostIpResolved;
		}
		let result = false;
		const ip = this._socket.remoteAddress!;
		try {
			const results = await dns.reverse(ip);
			if (results.length) {
				this._hostName = results[0];
				result = true;
			}
		} catch (e: unknown) {
			if (User._isDnsError(e)) {
				if (e.code !== NODATA && e.code !== NOTFOUND) {
					console.warn(`Error resolving IP ${ip}: ${e.code ?? 'no code'} (${e.message})`);
				}
			}
		}
		this._hostIpResolved = result;
		this._checkNewRegistration();
		return result;
	}

	giveMode(mode: ModeHandler, param?: string): void {
		const existingMode = this._modes.find(m => m.mode.letter === mode.letter);
		if (existingMode) {
			if (param === existingMode.param) {
				return;
			}
			existingMode.param = param;
		} else {
			this.addMode(mode, param);
		}
		const modes = param === undefined ? `+${mode.letter}` : `+${mode.letter} ${param}`;
		const msg = this._server.createMessage(MessageTypes.Commands.Mode, {
			target: this.connectionIdentifier,
			modes
		});
		this.sendMessage(msg);
	}

	addMode(mode: ModeHandler, param?: string): void {
		this._modes.push({ mode, param });
	}

	setNick(newNick: string): NickChangeResult {
		if (!this._server.nickChangeAllowed(this._nick, newNick)) {
			return 'inUse';
		}
		// if nick contains an invalid char or only numbers, it fails
		if (/[^a-zA-Z0-9[\]{}|\\^_-]/.test(newNick) || !/[^0-9]/.test(newNick)) {
			return 'invalid';
		}
		this._nick = newNick;
		if (!this._registered) {
			this._checkNewRegistration();
		}
		return 'ok';
	}

	setUserRegistration(user: string, realName: string): void {
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

	get publicHostName(): string {
		// TODO cloaking?
		return this._hostName;
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
			host: this.publicHostName
		};
	}

	get modes(): ModeState[] {
		return Array.from(this._modes);
	}

	get modesAsString(): string {
		return `+${this._modes.map(mode => mode.mode.letter).join('')}`;
	}

	get ipAddress(): string {
		return this._socket.remoteAddress!;
	}

	hasMode(letter: string): boolean {
		return this._modes.some(m => m.mode.letter === letter);
	}

	ifRegistered(cb: () => void): void {
		if (this.isRegistered) {
			cb();
		} else {
			this.sendNumericReply(MessageTypes.Numerics.Error451NotRegistered, {
				suffix: 'You have not registered'
			});
		}
	}

	processModes(changes: SingleMode[]): void {
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
				const removalIndex = filteredChanges.findIndex(
					change => change.letter === mode.letter && change.action === 'remove'
				);
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
				const addIndex = filteredChanges.findIndex(
					change => change.letter === mode.letter && change.action === 'add'
				);
				if (addIndex !== -1) {
					filteredChanges.splice(addIndex, 1);
				} else if (this._modes.find(currentMode => currentMode.mode.letter === mode.letter)) {
					filteredChanges.push(mode);
				} else {
					continue;
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
		this._modes = resultingModes.sort(Channel.stateSorter);

		const msg = this._server.createMessage(
			MessageTypes.Commands.Mode,
			{
				target: this.connectionIdentifier,
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

							return [letters, ...params];
						},
						['']
					)
					.join(' ')
			},
			this.prefix
		);

		this.sendMessage(msg);
	}

	addChannel(channel: Channel): void {
		this._channels.add(channel);
	}

	removeChannel(channel: Channel): void {
		this._channels.delete(channel);
	}

	get channels(): Set<Channel> {
		return new Set<Channel>(this._channels);
	}

	destroy(): boolean {
		if (!this._destroying) {
			this._destroying = true;
			this._socket.removeAllListeners('data');
			this._socket.destroy();
			this.removeListener();
			this._server.callHook('userDestroy', this);
			return true;
		}

		return false;
	}

	writeLine(str: string): void {
		console.log(`${this.connectionIdentifier} < ${str}`);
		this._socket.write(`${str}\r\n`);
	}

	sendMessage(msg: Message): void {
		this.writeLine(msg.toString(true));
	}

	sendNumericReply<T extends Message>(type: MessageConstructor<T>, params: Partial<MessageParamValues<T>>): void {
		this.writeLine(
			createMessage(
				type,
				{
					me: this.connectionIdentifier,
					...params
				},
				this._server.serverPrefix,
				undefined,
				undefined,
				true
			).toString(true)
		);
	}

	private _checkNewRegistration() {
		if (!this._registered && this._nick && this._userName && this._realName && this._hostIpResolved !== null) {
			this._registered = true;
			this.emit(this.onRegister);
		}
	}

	private static _isDnsError(e: unknown): e is NodeJS.ErrnoException {
		return e instanceof Error && 'code' in e;
	}
}
