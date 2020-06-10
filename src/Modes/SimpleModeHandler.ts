import ModeHandler, { ModeType } from './ModeHandler';

export default abstract class SimpleModeHandler extends ModeHandler {
	constructor(name: string, letter: string, type: ModeType) {
		super(name, letter, 'never', type);
	}
}
