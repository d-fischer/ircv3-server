import Channel from '../Channel';
import User from '../User';
import Server from '../Server';
import ModeHolder from '../Modes/ModeHolder';
import { SingleMode } from 'ircv3';
import ModuleComponentHolder from './ModuleComponentHolder';

export enum ModuleResult {
	ALLOW,
	DENY,
	NEXT
}

export interface ModuleHooks {
	onUserCreate?(user: User): ModuleResult;
	onUserDestroy?(user: User): ModuleResult;
	onChannelCreate?(channel: Channel, user: User): ModuleResult;
	onPreTopicChange?(channel: Channel, user: User, topic: string): ModuleResult;
	onChannelMessage?(channel: Channel, user: User, message: string): ModuleResult;
	onChannelJoin?(channel: Channel, user: User): ModuleResult;
	onModeChange?(target: ModeHolder, user: User, changes: SingleMode[]): ModuleResult;
}

abstract class Module {
	private _componentHolder?: ModuleComponentHolder;

	load(server: Server) {
		this._componentHolder = new ModuleComponentHolder(server);
		this.init(this._componentHolder);
	}

	abstract init(components: ModuleComponentHolder): void;

	unload(server: Server) {
		if (!this._componentHolder) {
			throw new Error('Trying to unload module that was not loaded');
		}
		this._componentHolder.removeAll();
		this._componentHolder = undefined;
	}
}

// this is just to merge the hooks interface to the class above
// tslint:disable-next-line:no-empty-interface
interface Module extends ModuleHooks {}

export default Module;
