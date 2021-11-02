import type { SingleMode } from 'ircv3';
import type { Channel } from '../Channel';
import type { ModeHolder } from '../Modes/ModeHolder';
import type { SendResponseCallback } from '../SendResponseCallback';
import type { User } from '../User';
import type { Module, ModuleResult } from './Module';

export interface ModuleHookTypes {
	channelCreate: (channelName: string, user: User, respond: SendResponseCallback) => ModuleResult;
	afterChannelCreate: (channel: Channel, user: User, respond: SendResponseCallback) => ModuleResult;
	channelJoin: (channel: Channel, user: User, respond: SendResponseCallback) => ModuleResult;
	channelMessage: (channel: Channel, user: User, message: string, respond: SendResponseCallback) => ModuleResult;
	channelNotice: (channel: Channel, user: User, message: string, respond: SendResponseCallback) => ModuleResult;
	channelTagMessage: (channel: Channel, user: User, respond: SendResponseCallback) => ModuleResult;
	modeChange: (target: ModeHolder, user: User, changes: SingleMode[], respond: SendResponseCallback) => ModuleResult;
	preTopicChange: (channel: Channel, user: User, topic: string, respond: SendResponseCallback) => ModuleResult;
	userCreate: (user: User) => ModuleResult;
	userDestroy: (user: User) => ModuleResult;
}

export class ModuleHook<HookType extends keyof ModuleHookTypes> {
	constructor(
		public readonly module: Module,
		public readonly type: HookType,
		private readonly _callback: ModuleHookTypes[HookType]
	) {}

	call(...args: Parameters<ModuleHookTypes[HookType]>): ModuleResult {
		return (this._callback as (...someArgs: Parameters<ModuleHookTypes[HookType]>) => ModuleResult).call(
			this.module,
			...args
		);
	}
}
