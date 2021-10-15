import SimpleModeHandler from './SimpleModeHandler';
import type { User } from '../User';
import type ModeHolder from './ModeHolder';

export default abstract class SimpleUserModeHandler extends SimpleModeHandler {
	constructor(name: string, letter: string) {
		super(name, letter, 'user');
	}

	canSetOn(target: ModeHolder, user: User): boolean {
		return user === target;
	}
}
