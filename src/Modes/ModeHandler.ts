import type { Server } from '../Server';
import { assertNever } from '../Toolkit/TypeTools';
import type { User } from '../User';
import type { ModeHolder } from './ModeHolder';

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

	get paramSpec(): ModeParamSpec {
		return this._params;
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

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	checkValidity(target: ModeHolder, user: User, server: Server, adding: boolean, param?: string): boolean {
		return true;
	}
	abstract checkAccess(target: ModeHolder, user: User, server: Server, adding: boolean, param?: string): boolean;

	protected _getCurrentParam(holder: ModeHolder): string | undefined {
		return holder.getModeData(this)?.param;
	}
}
