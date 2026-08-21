import type { MloSnapshot } from './snapshot.js';

export interface MloMessageBase {
  schema: string;
  id: number;
  type: string;
  data: unknown;
}

export interface MloSnapshotMessage extends MloMessageBase {
  type: 'snapshot';
  data: MloSnapshot;
}

export interface MloCallMessage extends MloMessageBase {
  type: 'call';
  data: {
    method: string;
    args: unknown[];
  };
}

export type MloMessage = MloSnapshotMessage | MloCallMessage;

export interface MloMessageEvent extends MessageEvent {
  data: MloMessage;
}
