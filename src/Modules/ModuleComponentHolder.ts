import type { ModeHandler } from '../Modes/ModeHandler';
import type { Server } from '../Server';
import type { CommandHandler } from '../Commands/CommandHandler';
import type { Module } from './Module';
import { ModuleHook } from './ModuleHook';
import type { ModuleHookTypes } from './ModuleHook';

export class ModuleComponentHolder {
	private _modes: ModeHandler[] = [];
	private readonly _commands: CommandHandler[] = [];
	private readonly _hooks: Array<ModuleHook<never>> = [];

	constructor(private readonly _module: Module, private readonly _server: Server) {}

	addMode(mode: ModeHandler): void {
		if (this._server.findModeByName(mode.name, mode.type)) {
			throw new Error(`Mode registration conflict: trying to add more than one mode with the name ${mode.name}`);
		}
		if (this._server.findModeByLetter(mode.letter, mode.type)) {
			throw new Error(
				`Mode registration conflict: trying to add more than one mode with the letter ${mode.letter}`
			);
		}
		this._server.addMode(mode);
		this._modes.push(mode);
	}

	addCommand(command: CommandHandler): void {
		if (this._server.addCommand(command)) {
			this._commands.push(command);
		}
	}

	addHook<HookType extends keyof ModuleHookTypes>(type: HookType, callback: ModuleHookTypes[HookType]): void {
		const hook = new ModuleHook(this._module, type, callback) as ModuleHook<never>;
		this._server.addModuleHook(hook);
		this._hooks.push(hook);
	}

	removeAll(): void {
		for (const mode of this._modes) {
			this._server.removeMode(mode);
		}
		for (const command of this._commands) {
			this._server.removeCommand(command);
		}
		for (const hook of this._hooks) {
			this._server.removeModuleHook(hook);
		}
		this._modes = [];
	}
}
