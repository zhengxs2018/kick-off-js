import type { MloMessage, MloMessageEvent } from '../../types/message.js';
import { isObject } from '../common/utils.js';
import { MLO_MESSAGE_EVENT_SCHEMA } from './consts.js';

let idxCounter = 0;

export function createMloMessage(type: string, data: unknown) {
  return { schema: MLO_MESSAGE_EVENT_SCHEMA, type, data, id: idxCounter++ } as MloMessage;
}

export function isMloMessageEvent(event: MessageEvent): event is MloMessageEvent {
  return isMloMessage(event.data);
}

export function isMloMessage(data: unknown): data is MloMessage {
  return isObject<MloMessage>(data) && data.schema === MLO_MESSAGE_EVENT_SCHEMA;
}
