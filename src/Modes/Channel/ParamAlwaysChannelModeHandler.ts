import { BaseChannelModeHandler } from './BaseChannelModeHandler';

export class ParamAlwaysChannelModeHandler extends BaseChannelModeHandler {
	constructor(name: string, letter: string, minAccess?: string) {
		super(name, letter, minAccess, 'always');
	}
}
