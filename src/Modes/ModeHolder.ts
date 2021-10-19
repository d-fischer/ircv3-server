import type { ModeState } from '../Toolkit/ModeTools';
import type { SingleMode } from 'ircv3';
import type { User } from '../User';

export interface ModeHolder {
	readonly modes: ModeState[];
	readonly modesAsString: string;
	processModes: (changes: SingleMode[], source: User) => void;
}
