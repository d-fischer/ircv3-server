import { assertNever } from '../Toolkit/TypeTools';
import type { User } from '../User';
import type { ModeHolder } from './ModeHolder';
import type { Server } from '../Server';

export type ModeParamSpec = 'never' | 'setOnly' | 'always';
export type ModeType = 'user' | 'channel';

export abstract class ModeHandler {
	constructor(
		private readonly _name: string,
		private readonly _letter: string,
		private readonly _params: ModeParamSpec,
		private readonly _type: ModeType
	) {}

	get name(): string {
		return this._name;
	}

	get letter(): string {
		return this._letter;
	}

	get type(): ModeType {
		return this._type;
	}

	needsParam(isSetting: boolean): boolean {
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
				return assertNever(this._params);
			}
		}
	}

	abstract canSetOn(target: ModeHolder, user: User, server: Server, adding: boolean, param?: string): boolean;
}
