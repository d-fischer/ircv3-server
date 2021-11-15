import { BaseChannelModeHandler } from './BaseChannelModeHandler';

export class NoParamChannelModeHandler extends BaseChannelModeHandler {
	constructor(name: string, letter: string, minAccess?: string) {
		super(name, letter, minAccess, 'never');
	}
}
