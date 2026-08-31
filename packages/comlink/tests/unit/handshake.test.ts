import { describe, expect, test } from 'bun:test';

import { handshakeHello, isHandshakeHello, WEB_RPC_PROBE_FLAG } from '../../src/core/handshake.js';

describe('handshakeHello', () => {
  test('produces a valid handshake envelope', () => {
    const hello = handshakeHello('ghost');
    expect(hello.handshake).toBe(true);
    expect(hello.version).toBe('1.0');
    expect(hello.name).toBe('ghost');
  });
});

describe('isHandshakeHello', () => {
  test('accepts a well-formed hello', () => {
    expect(isHandshakeHello(handshakeHello('ghost'))).toBe(true);
  });

  test('rejects non-objects', () => {
    expect(isHandshakeHello(null)).toBe(false);
    expect(isHandshakeHello('hello')).toBe(false);
  });

  test('rejects missing handshake flag', () => {
    expect(isHandshakeHello({ version: '1.0', name: 'ghost' })).toBe(false);
  });

  test('rejects wrong version', () => {
    expect(isHandshakeHello({ handshake: true, version: '2.0', name: 'ghost' })).toBe(false);
  });

  test('rejects probe flag object without handshake shape', () => {
    expect(isHandshakeHello({ [WEB_RPC_PROBE_FLAG]: true })).toBe(false);
  });
});
