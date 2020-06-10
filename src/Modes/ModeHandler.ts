import { assertNever } from '../Toolkit/TypeTools';
import User from '../User';
import ModeHolder from './ModeHolder';
import Server from '../Server';

export type ModeParamSpec = 'never' | 'setOnly' | 'always';
export type ModeType = 'user' | 'channel';

export default abstract class ModeHandler {
	constructor(private readonly _name: string, private readonly _letter: string, private readonly _params: ModeParamSpec, private readonly _type: ModeType) {}

	get name() {
		return this._name;
	}

	get letter() {
		return this._letter;
	}

	get type() {
		return this._type;
	}

	needsParam(isSetting: boolean) {
		switch (this._params) {
			case 'never': {
				return false;
			}

			case 'setOnly': {
				return isSetting;
			}

			case 'always': {
				return true;
			}

			default: {
				assertNever(this._params);
			}
		}
	}

	abstract canSetOn(target: ModeHolder, user: User, server: Server, adding: boolean, param?: string): boolean;
}
