import { MessageTypes } from 'ircv3';
import type { SendResponseCallback } from '../../../SendResponseCallback';
import { Module, ModuleResult } from '../../Module';
import { InviteOnlyModeHandler } from './InviteOnlyModeHandler';
import type { ModuleComponentHolder } from '../../ModuleComponentHolder';
import { InviteCommandHandler } from './InviteCommandHandler';
import type { Invite } from './Invite';
import type { User } from '../../../User';
import type { Channel } from '../../../Channel';

export class InviteModule extends Module {
	private readonly _invitesByUser = new Map<User, Set<Invite>>();
	private readonly _inviteOnlyMode = new InviteOnlyModeHandler();
	private readonly _inviteCommand = new InviteCommandHandler(this._inviteOnlyMode, this);

	init(components: ModuleComponentHolder): void {
		components.addMode(this._inviteOnlyMode);
		components.addCommand(this._inviteCommand);
		components.addHook('channelJoin', this.onChannelJoin);
		components.addHook('userDestroy', this.onUserDestroy);
	}

	_addInvite(invite: Invite): void {
		let invitesForThisUser = this._invitesByUser.get(invite.user);

		if (!invitesForThisUser) {
			invitesForThisUser = new Set<Invite>();
			this._invitesByUser.set(invite.user, invitesForThisUser);
		}

		invitesForThisUser.add(invite);
	}

	onChannelJoin = (channel: Channel, user: User, respond: SendResponseCallback): ModuleResult => {
		if (channel.hasModeSet(this._inviteOnlyMode)) {
			const invitesForUser = this._invitesByUser.get(user);

			if (invitesForUser) {
				for (const invite of invitesForUser) {
					if (invite.channel === channel) {
						invitesForUser.delete(invite);
						return ModuleResult.NEXT;
					}
				}
			}

			respond(MessageTypes.Numerics.Error473InviteOnlyChan, {
				channel: channel.name,
				suffix: 'Cannot join channel (+i)'
			});
			return ModuleResult.DENY;
		}

		return ModuleResult.NEXT;
	};

	onUserDestroy = (user: User): ModuleResult => {
		if (this._invitesByUser.has(user)) {
			this._invitesByUser.delete(user);
		}

		return ModuleResult.NEXT;
	};
}
