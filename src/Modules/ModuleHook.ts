import type { MessageTypes, SingleMode } from 'ircv3';
import type { Channel } from '../Channel';
import type { ModeHolder } from '../Modes/ModeHolder';
import type { SendResponseCallback } from '../SendResponseCallback';
import type { Server } from '../Server';
import type { ModeState } from '../Toolkit/ModeTools';
import type { User } from '../User';
import type { HookResult, Module } from './Module';

export interface ChannelVisibilityResult {
	secret: boolean;
}

export interface ChannelCreateFlags {
	modesToSet: ModeState[];
}

export interface ModuleHookTypes {
	channelCreate: (channelName: string, user: User, respond: SendResponseCallback) => HookResult;
	afterChannelCreate: (channel: Channel, user: User, result: ChannelCreateFlags) => HookResult;
	channelJoin: (
		channel: Channel,
		user: User,
		cmd: MessageTypes.Commands.ChannelJoin,
		respond: SendResponseCallback,
		server: Server
	) => HookResult;
	channelMessage: (channel: Channel, user: User, message: string, respond: SendResponseCallback) => HookResult;
	channelNotice: (channel: Channel, user: User, message: string, respond: SendResponseCallback) => HookResult;
	channelTagMessage: (channel: Channel, user: User, respond: SendResponseCallback) => HookResult;
	modeChange: (target: ModeHolder, user: User, changes: SingleMode[], respond: SendResponseCallback) => HookResult;
	preTopicChange: (channel: Channel, user: User, topic: string, respond: SendResponseCallback) => HookResult;
	userCreate: (user: User) => HookResult;
	userDestroy: (user: User) => HookResult;
	channelCheckVisibility: (channel: Channel, user: User, result: ChannelVisibilityResult) => HookResult;
}

export class ModuleHook<HookType extends keyof ModuleHookTypes> {
	constructor(
		public readonly module: Module,
		public readonly type: HookType,
		private readonly _callback: ModuleHookTypes[HookType]
	) {}

	call(...args: Parameters<ModuleHookTypes[HookType]>): HookResult {
		return (this._callback as (...someArgs: Parameters<ModuleHookTypes[HookType]>) => HookResult).call(
			this.module,
			...args
		);
	}
}
