import { describe, expect, test } from 'bun:test';

import {
  isRpcEventMethod,
  RpcErrorResponseSchema,
  RpcEventSchema,
  RpcRequestSchema,
  RpcSuccessResponseSchema,
  rpcEvent,
  withEventPrefix,
  RPC_EVENT_PREFIX,
} from '../../src/core/schema.js';

describe('rpcEvent / withEventPrefix', () => {
  test('rpcEvent wraps name with prefix and params', () => {
    const event = rpcEvent('open', [{ name: 'ghost' }]);
    expect(event.jsonrpc).toBe('2.0');
    expect(event.method).toBe(`${RPC_EVENT_PREFIX}open`);
    expect(event.params).toEqual([{ name: 'ghost' }]);
  });

  test('rpcEvent defaults params to empty array', () => {
    expect(rpcEvent('tick').params).toEqual([]);
  });

  test('withEventPrefix is idempotent for already-prefixed names', () => {
    const prefixed = `${RPC_EVENT_PREFIX}open`;
    expect(withEventPrefix(prefixed)).toBe(prefixed);
  });

  test('withEventPrefix adds prefix to bare names', () => {
    expect(withEventPrefix('open')).toBe(`${RPC_EVENT_PREFIX}open`);
  });
});

describe('isRpcEventMethod', () => {
  test('true for prefixed methods', () => {
    expect(isRpcEventMethod(`${RPC_EVENT_PREFIX}open`)).toBe(true);
  });

  test('false for bare or other methods', () => {
    expect(isRpcEventMethod('echo')).toBe(false);
    expect(isRpcEventMethod('open')).toBe(false);
  });
});

describe('schema validation', () => {
  test('RpcRequestSchema rejects empty method', () => {
    expect(RpcRequestSchema.safeParse({ jsonrpc: '2.0', method: '', params: [] }).success).toBe(
      false,
    );
  });

  test('RpcRequestSchema accepts valid request with default params', () => {
    const result = RpcRequestSchema.safeParse({ jsonrpc: '2.0', method: 'echo' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.params).toEqual([]);
  });

  test('RpcRequestSchema rejects more than 2 params', () => {
    expect(
      RpcRequestSchema.safeParse({ jsonrpc: '2.0', method: 'echo', params: [1, 2, 3] }).success,
    ).toBe(false);
  });

  test('RpcSuccessResponseSchema requires result key', () => {
    expect(RpcSuccessResponseSchema.safeParse({ jsonrpc: '2.0', id: 1, result: 42 }).success).toBe(
      true,
    );
    expect(RpcSuccessResponseSchema.safeParse({ jsonrpc: '2.0', id: 1 }).success).toBe(false);
  });

  test('RpcErrorResponseSchema requires error code/message', () => {
    expect(
      RpcErrorResponseSchema.safeParse({ jsonrpc: '2.0', id: 1, error: { code: -1, message: 'x' } })
        .success,
    ).toBe(true);
    expect(RpcErrorResponseSchema.safeParse({ jsonrpc: '2.0', id: 1, error: {} }).success).toBe(
      false,
    );
  });

  test('RpcEventSchema requires prefixed method', () => {
    expect(
      RpcEventSchema.safeParse({ jsonrpc: '2.0', method: `${RPC_EVENT_PREFIX}open` }).success,
    ).toBe(true);
    expect(RpcEventSchema.safeParse({ jsonrpc: '2.0', method: 'open' }).success).toBe(false);
  });
});
