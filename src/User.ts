import { EventEmitter } from '@d-fischer/typed-event-emitter';
import { NODATA, NOTFOUND, promises as dns } from 'dns';
import type { Capability, Message, MessageConstructor, MessageParamValues, MessagePrefix, SingleMode } from 'ircv3';
import { Acknowledgement, Batch, CoreCapabilities, createMessage, MessageTypes } from 'ircv3';
import type * as net from 'net';
import { Channel } from './Channel';
import type { ModeHandler } from './Modes/ModeHandler';
import type { ModeHolder } from './Modes/ModeHolder';
import type { SendableMessageProperties } from './SendableMessageProperties';
import type { SendResponseCallback, SendResponseIntermediateObject } from './SendResponseCallback';
import type { Server } from './Server';
import type { ModeState } from './Toolkit/ModeTools';

interface NickChangeInvalidResult {
	result: 'invalid';
}

interface NickChangeInUseResult {
	result: 'inUse';
}

interface NickChangeOkResult {
	result: 'ok';
	newNick: string;
}

type NickChangeResult = NickChangeInvalidResult | NickChangeInUseResult | NickChangeOkResult;

export class User extends EventEmitter implements ModeHolder {
	private _nick?: string;
	private _userName?: string;
	private _hostName: string;
	private _realName?: string;

	private _hostIpResolved: boolean | null = null;
	private _capabilitiesNegotiating = false;
	private _registered = false;
	private _destroying = false;

	private _modes: ModeState[] = [];
	private readonly _channels = new Set<Channel>();

	private _capabilityNegotiationVersion: number | null = null;
	private readonly _negotiatedCapabilities = new Map<string, Capability>();
	private _supportsTags = false;
	private _currentBatchReference = 0;

	private _awayMessage: string | null = null;

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
		_socket.on('close', () => this._server.quitUser(this, 'Connection closed'));
		_socket.on('error', () => this._server.quitUser(this, 'Connection error occurred'));
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

	get capabilityNegotiationVersion(): number | null {
		return this._capabilityNegotiationVersion;
	}

	get capabilityNames(): string[] {
		return Array.from(this._negotiatedCapabilities.keys());
	}

	set capabilitiesNegotiating(value: boolean) {
		this._capabilitiesNegotiating = value;
		if (!value && !this._registered) {
			this._checkNewRegistration();
		}
	}

	hasCapability(cap: Capability): boolean {
		return this._negotiatedCapabilities.has(cap.name);
	}

	updateCapVersion(ver: number): void {
		if (this._capabilityNegotiationVersion == null) {
			this._capabilityNegotiationVersion = ver;
		} else {
			this._capabilityNegotiationVersion = Math.max(this._capabilityNegotiationVersion, ver);
		}
	}

	addCapability(cap: Capability): void {
		this._negotiatedCapabilities.set(cap.name, cap);
		this._supportsTags ||= cap.usesTags ?? false;
	}

	removeCapability(cap: Capability): void {
		this._negotiatedCapabilities.delete(cap.name);
		this._supportsTags = Array.from(this._negotiatedCapabilities.values()).some(
			existingCap => existingCap.usesTags
		);
	}

	get awayMessage(): string | null {
		return this._awayMessage;
	}

	get isAway(): boolean {
		return this._awayMessage != null;
	}

	isOper(forForeignServer = false): boolean {
		return this.hasMode('globalOper') || (!forForeignServer && this.hasMode('localOper'));
	}

	setAwayMessage(msg: string | null): void {
		this._awayMessage = msg;
		this._server.forEachCommonChannelUser(this, commonUser => {
			if (commonUser.hasCapability(CoreCapabilities.AwayNotify)) {
				commonUser.sendMessage(
					MessageTypes.Commands.Away,
					{
						message: msg ?? undefined
					},
					this.prefix
				);
			}
		});
	}

	giveMode(mode: ModeHandler, param?: string, respond?: SendResponseCallback): void {
		const sendMessageToUser =
			respond ??
			(<T extends Message<T>>(type: MessageConstructor<T>, params: MessageParamValues<T>) =>
				this.sendMessage(type, params));
		const existingMode = this._modes.find(m => m.mode.name === mode.name);
		if (existingMode) {
			if (param === existingMode.param) {
				return;
			}
			existingMode.param = param;
		} else {
			this.addMode(mode, param);
		}
		const modes = param === undefined ? `+${mode.letter}` : `+${mode.letter} ${param}`;
		sendMessageToUser(MessageTypes.Commands.Mode, {
			target: this.connectionIdentifier,
			modes
		});
	}

	addMode(mode: ModeHandler, param?: string): void {
		this._modes.push({ mode, param });
	}

	setNick(newNick: string): NickChangeResult {
		if (!this._server.nickChangeAllowed(this._nick, newNick)) {
			return { result: 'inUse' };
		}
		// if nick contains an invalid char or only numbers, it fails
		if (/[^a-zA-Z0-9[\]{}|\\^_-]/.test(newNick) || !/[^0-9]/.test(newNick)) {
			return { result: 'invalid' };
		}
		const oldNick = this._nick;
		newNick = newNick.slice(0, this._server.nickLength);
		this._nick = newNick;
		if (this._registered) {
			this.emit(this.onNickChange, oldNick);
		} else {
			this._checkNewRegistration();
		}
		return { result: 'ok', newNick };
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

	get publicHostNameAsParam(): string {
		return this.publicHostName.replace(/^:/, '0:');
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

	hasMode(name: string): boolean {
		return this._modes.some(m => m.mode.name === name);
	}

	processModes(changes: SingleMode[], source: User, respond: SendResponseCallback): void {
		const resultingModes = this._modes.slice();
		const filteredChanges: SingleMode[] = [];
		for (const mode of changes) {
			const modeDescriptor = this._server.findModeByLetter(mode.letter, 'user')!;
			const adding = mode.action === 'add';
			if (!modeDescriptor.checkAccess(this, this, this._server, adding, mode.param)) {
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

		const modes = filteredChanges
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
			.join(' ');

		respond(
			MessageTypes.Commands.Mode,
			{
				target: this.connectionIdentifier,
				modes: modes
			},
			this.prefix
		);
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

	isVisibleFor(otherUser: User): boolean {
		const otherUserChannels = otherUser.channels;
		return !this.hasMode('invisible') || [...this._channels].some(channel => otherUserChannels.has(channel));
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

	sendMessage<T extends Message<T>>(
		type: MessageConstructor<T>,
		params: MessageParamValues<T>,
		prefix: MessagePrefix = this._server.serverPrefix,
		properties?: SendableMessageProperties
	): void {
		let tags: Map<string, string> | undefined = undefined;
		if (this._supportsTags) {
			tags =
				(this._negotiatedCapabilities.has(CoreCapabilities.MessageTags.name) ? properties?.clientTags : null) ??
				new Map<string, string>();

			if (properties) {
				if (this.hasCapability(CoreCapabilities.Batch)) {
					if (properties.partOfBatch) {
						tags.set('batch', properties.partOfBatch);
					}
					if (this.hasCapability(CoreCapabilities.LabeledResponse)) {
						if (properties.repliesToLabel) {
							tags.set('label', properties.repliesToLabel);
						}
					}
				}
			}
		}

		const msg: Message = createMessage(type, params, prefix, tags, this._server.serverProperties, true);
		this.sendRawMessage(msg.toString(true));
	}

	sendResponse(toMsg: Message, cb?: (respond: SendResponseCallback) => void): void {
		const messagesParts: SendResponseIntermediateObject[] = [];

		// allow to not pass a callback to simply send an ACK if applicable
		if (cb) {
			const respondFn: SendResponseCallback = (type: MessageConstructor, params, prefix, properties) => {
				const extendedParams: Record<string, string | undefined> = { ...params };
				if (type.PARAM_SPEC && Object.prototype.hasOwnProperty.call(type.PARAM_SPEC, 'me')) {
					extendedParams.me = this.connectionIdentifier;
				}
				messagesParts.push({
					type,
					params: extendedParams,
					prefix,
					properties
				});
			};

			cb(respondFn);
		}

		const labelTag = toMsg.tags.get('label');
		const supportsLabeledResponse =
			this.hasCapability(CoreCapabilities.LabeledResponse) && this.hasCapability(CoreCapabilities.Batch);
		if (!supportsLabeledResponse || !labelTag || messagesParts.length === 1) {
			for (const { type, params, prefix, properties } of messagesParts) {
				this.sendMessage(type, params, prefix, {
					...properties,
					repliesToLabel: labelTag
				});
			}
			return;
		}

		if (messagesParts.length === 0) {
			this.sendMessage(Acknowledgement, {}, undefined, {
				repliesToLabel: labelTag
			});
			return;
		}

		const reference = this._currentBatchReference.toString().padStart(5, '0');
		this._currentBatchReference = (this._currentBatchReference + 1) % 1e6;

		this.sendMessage(
			Batch,
			{
				reference: `+${reference}`,
				type: 'labeled-response',
				additionalParams: undefined
			},
			undefined,
			{
				repliesToLabel: labelTag
			}
		);
		for (const { type, params, prefix, properties } of messagesParts) {
			this.sendMessage(type, params, prefix, {
				...properties,
				partOfBatch: reference
			});
		}
		this.sendMessage(Batch, {
			reference: `-${reference}`
		});
	}

	sendRawMessage(msg: string): void {
		console.log(`${this.connectionIdentifier} < ${msg}`);
		this._socket.write(`${msg}\r\n`);
	}

	sendNumeric<T extends Message>(type: MessageConstructor<T>, params: Omit<MessageParamValues<T>, 'me'>): void {
		this.sendRawMessage(
			this._server
				.createMessage(
					type,
					// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
					{
						me: this.connectionIdentifier,
						...params
					} as MessageParamValues<T>,
					this._server.serverPrefix
				)
				.toString(true)
		);
	}

	private _checkNewRegistration() {
		if (
			!this._registered &&
			this._nick &&
			this._userName &&
			this._realName &&
			this._hostIpResolved !== null &&
			!this._capabilitiesNegotiating
		) {
			if (this._server.nickExists(this._nick)) {
				this.sendMessage(MessageTypes.Numerics.Error433NickNameInUse, {
					me: '*',
					nick: this._nick,
					suffix: 'Nick already in use'
				});
			} else {
				this._registered = true;
				this.emit(this.onRegister);
			}
		}
	}

	private static _isDnsError(e: unknown): e is NodeJS.ErrnoException {
		return e instanceof Error && 'code' in e;
	}
}
