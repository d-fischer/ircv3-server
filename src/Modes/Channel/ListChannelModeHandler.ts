import type { Channel } from '../../Channel';
import type { SendResponseCallback } from '../../SendResponseCallback';
import type { Server } from '../../Server';
import type { User } from '../../User';
import { BaseChannelModeHandler } from './BaseChannelModeHandler';

export interface ListEntry {
	value: string;
	creatorName: string;
	timestamp: number;
}

export interface ListChangeHandler {
	add: (value: string) => void;
	remove: (value: string) => void;
	has: (value: string) => boolean;
	finalize: () => void;
}

export abstract class ListChannelModeHandler extends BaseChannelModeHandler {
	private readonly _listsByChannel = new Map<Channel, ListEntry[]>();

	constructor(name: string, letter: string, minAccess?: string) {
		super(name, letter, minAccess, 'list');
	}

	change(channel: Channel, server: Server, creator?: User): ListChangeHandler {
		const listState = this._listsByChannel.get(channel) ?? [];
		return {
			add: (value: string) => {
				listState.push({
					value,
					creatorName: creator?.nick ?? server.serverAddress,
					timestamp: Date.now()
				});
			},
			remove: (value: string) => {
				const foundIndex = listState.findIndex(entry => entry.value === value);
				if (foundIndex !== -1) {
					listState.splice(foundIndex, 1);
				}
			},
			has: (value: string) => listState.some(entry => entry.value === value),
			finalize: () => {
				this._listsByChannel.set(channel, listState);
			}
		};
	}

	matches(channel: Channel, user: User, server: Server): boolean {
		return (this._listsByChannel.get(channel) ?? []).some(entry => {
			const [firstPart, hostMask] = entry.value.split('@');
			const [nickMask, userMask] = firstPart.split('!');

			return (
				server.identifierMatchesWildcard(user.nick!, nickMask) &&
				server.identifierMatchesWildcard(user.userName!, userMask) &&
				server.identifierMatchesWildcard(user.publicHostName, hostMask)
			);
		});
	}

	abstract sendList(channel: Channel, user: User, respond: SendResponseCallback): void;

	protected getList(channel: Channel): ListEntry[] {
		return this._listsByChannel.get(channel) ?? [];
	}
}
