import Module, { ModuleResult } from '../../Module';
import InviteOnlyModeHandler from './InviteOnlyModeHandler';
import ModuleComponentHolder from '../../ModuleComponentHolder';
import InviteCommandHandler from './InviteCommandHandler';
import Invite from './Invite';
import User from '../../../User';
import Channel from '../../../Channel';
import * as Numerics from 'ircv3/lib/Message/MessageTypes/Numerics';

export default class InviteModule extends Module {
	private readonly _invites = new Set<Invite>();
	private readonly _invitesByUser = new Map<User, Set<Invite>>();
	private readonly _inviteOnlyMode = new InviteOnlyModeHandler();
	private readonly _inviteCommand = new InviteCommandHandler(this._inviteOnlyMode, this);

	init(components: ModuleComponentHolder) {
		components.addMode(this._inviteOnlyMode);
		components.addCommand(this._inviteCommand);
	}

	_addInvite(invite: Invite) {
		this._invites.add(invite);

		let invitesForThisUser = this._invitesByUser.get(invite.user);

		if (!invitesForThisUser) {
			invitesForThisUser = new Set<Invite>();
			this._invitesByUser.set(invite.user, invitesForThisUser);
		}

		invitesForThisUser.add(invite);
	}

	onChannelJoin(channel: Channel, user: User): ModuleResult {
		if (channel.hasModeSet(this._inviteOnlyMode)) {
			const invitesForUser = this._invitesByUser.get(user);

			if (invitesForUser) {
				for (const invite of invitesForUser) {
					if (invite.channel === channel) {
						this._invites.delete(invite);
						invitesForUser.delete(invite);
						return ModuleResult.NEXT;
					}
				}
			}

			user.sendNumericReply(Numerics.Error473InviteOnlyChan, {
				channel: channel.name,
				suffix: 'Cannot join channel (+i)'
			});
			return ModuleResult.DENY;
		}

		return ModuleResult.NEXT;
	}

	onUserDestroy(user: User): ModuleResult {
		if (this._invitesByUser.has(user)) {
			for (const invite of this._invitesByUser.get(user)!) {
				this._invites.delete(invite);
			}

			this._invitesByUser.delete(user);
		}

		return ModuleResult.NEXT;
	}
}
