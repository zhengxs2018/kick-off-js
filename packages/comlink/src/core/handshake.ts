import { isObject } from '../common/util.js';

export const WEB_RPC_PROBE_FLAG = '__WEB_RPC_PROBE__';

export interface HandshakeHello {
  readonly handshake: true;
  readonly version: '1.0';
  readonly name: string;
}

export function handshakeHello(name: string): HandshakeHello {
  return { handshake: true, version: '1.0', name };
}

export function isHandshakeHello(data: unknown): data is HandshakeHello {
  return isObject<HandshakeHello>(data) && data.handshake === true && data.version === '1.0';
}
