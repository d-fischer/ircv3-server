import type { ModeHandler } from '../Modes/ModeHandler';
import type { Server } from '../Server';
import type CommandHandler from '../Commands/CommandHandler';

export default class ModuleComponentHolder {
	private _modes: ModeHandler[] = [];
	private readonly _commands: CommandHandler[] = [];

	constructor(private readonly _server: Server) {}

	addMode(mode: ModeHandler): void {
		this._server.addMode(mode);
		this._modes.push(mode);
	}

	addCommand(command: CommandHandler): void {
		if (this._server.addCommand(command)) {
			this._commands.push(command);
		}
	}

	removeAll(): void {
		for (const mode of this._modes) {
			this._server.removeMode(mode);
		}
		for (const command of this._commands) {
			this._server.removeCommand(command);
		}
		this._modes = [];
	}
}
