import type { SingleMode } from 'ircv3';
import type { Channel } from '../Channel';
import type { ModeHolder } from '../Modes/ModeHolder';
import type { User } from '../User';
import type { Module, ModuleResult } from './Module';

export interface ModuleHookTypes {
	userCreate: (user: User) => ModuleResult;
	userDestroy: (user: User) => ModuleResult;
	channelCreate: (channel: Channel, user: User) => ModuleResult;
	preTopicChange: (channel: Channel, user: User, topic: string) => ModuleResult;
	channelMessage: (channel: Channel, user: User, message: string) => ModuleResult;
	channelJoin: (channel: Channel, user: User) => ModuleResult;
	modeChange: (target: ModeHolder, user: User, changes: SingleMode[]) => ModuleResult;
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
