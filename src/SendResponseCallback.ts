import type { Message, MessageConstructor, MessageParamValues, MessagePrefix } from 'ircv3';
import type { SendableMessageProperties } from './SendableMessageProperties';

export interface SendResponseIntermediateObject {
	type: MessageConstructor<Message & unknown>;
	params: MessageParamValues<Message & unknown>;
	prefix?: MessagePrefix;
	properties?: SendableMessageProperties;
}

export type SendResponseCallback = <T extends Message<T>>(
	type: MessageConstructor<T>,
	params: Omit<MessageParamValues<T>, 'me'>,
	prefix?: MessagePrefix,
	properties?: SendableMessageProperties
) => void;
