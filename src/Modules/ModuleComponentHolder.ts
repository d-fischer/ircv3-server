import ModeHandler from '../Modes/ModeHandler';
import Server from '../Server';
import CommandHandler from '../Commands/CommandHandler';

export default class ModuleComponentHolder {
	private _modes: ModeHandler[] = [];
	private _commands: CommandHandler[] = [];

	constructor(private readonly _server: Server) {
	}

	addMode(mode: ModeHandler) {
		this._server.addMode(mode);
		this._modes.push(mode);
	}

	addCommand(command: CommandHandler) {
		if (this._server.addCommand(command)) {
			this._commands.push(command);
		}
	}

	removeAll() {
		for (const mode of this._modes) {
			this._server.removeMode(mode);
		}
		for (const command of this._commands) {
			this._server.removeCommand(command);
		}
		this._modes = [];
	}
}
