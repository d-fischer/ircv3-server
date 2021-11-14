import type { SingleMode } from 'ircv3';
import type { SendResponseCallback } from '../SendResponseCallback';
import type { ModeState } from '../Toolkit/ModeTools';
import type { User } from '../User';
import type { ModeHandler } from './ModeHandler';

export interface ModeHolder {
	readonly modes: ModeState[];
	readonly modesAsString: string;
	processModes: (changes: SingleMode[], source: User, response: SendResponseCallback) => void;
	getModeData: (mode: ModeHandler) => ModeState | null;
}
