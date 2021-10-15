import type { ModeHandler } from '../Modes/ModeHandler';

export interface ModeState {
	mode: ModeHandler;
	param?: string;
}
