import { MessageTypes } from 'ircv3';
import type { Channel } from '../../../Channel';
import { NoParamChannelModeHandler } from '../../../Modes/Channel/NoParamChannelModeHandler';
import type { SendResponseCallback } from '../../../SendResponseCallback';
import type { User } from '../../../User';
import { HookResult, Module } from '../../Module';
import type { ModuleComponentHolder } from '../../ModuleComponentHolder';
import type { Invite } from './Invite';
import { InviteCommandHandler } from './InviteCommandHandler';

export class InviteModule extends Module {
	private readonly _invitesByUser = new Map<User, Set<Invite>>();
	private readonly _inviteOnlyMode = new NoParamChannelModeHandler('inviteOnly', 'i', 'op');
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

	onChannelJoin = (
		channel: Channel,
		user: User,
		cmd: MessageTypes.Commands.ChannelJoin,
		respond: SendResponseCallback
	): HookResult => {
		if (channel.hasModeSet(this._inviteOnlyMode)) {
			const invitesForUser = this._invitesByUser.get(user);

			if (invitesForUser) {
				for (const invite of invitesForUser) {
					if (invite.channel === channel) {
						invitesForUser.delete(invite);
						return HookResult.NEXT;
					}
				}
			}

			respond(MessageTypes.Numerics.Error473InviteOnlyChan, {
				channel: channel.name,
				suffix: 'Cannot join channel (+i)'
			});
			return HookResult.DENY;
		}

		return HookResult.NEXT;
	};

	onUserDestroy = (user: User): HookResult => {
		if (this._invitesByUser.has(user)) {
			this._invitesByUser.delete(user);
		}

		return HookResult.NEXT;
	};
}
