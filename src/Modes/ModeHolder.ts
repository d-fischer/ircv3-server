import { ModeState } from '../Toolkit/ModeTools';
import { SingleMode } from 'ircv3';
import User from '../User';

interface ModeHolder {
	readonly modes: ModeState[];
	readonly modesAsString: string;
	processModes(changes: SingleMode[], source: User): void;
}

export default ModeHolder;
