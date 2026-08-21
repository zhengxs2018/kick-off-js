import { describe, expect, test } from 'bun:test';
import { z } from 'zod';

import { createRpcHost } from '../core/host.js';
import type { RpcRequest } from '../core/schema.js';

function request(partial: Partial<RpcRequest> & Pick<RpcRequest, 'method'>): RpcRequest {
  return {
    jsonrpc: '2.0',
    method: partial.method,
    params: partial.params ?? [],
    id: partial.id,
  } as RpcRequest;
}

describe('createRpcHost', () => {
  test('invoke with id returns success response', async () => {
    const host = createRpcHost();
    host.handle({ name: 'double', input: z.number(), handler: n => n * 2 });
    const result = await host.invoke(
      request({ method: 'double', params: [4], id: 1 }),
      new AbortController().signal,
    );
    expect(result?.response).toEqual({ jsonrpc: '2.0', id: 1, result: 8 });
  });

  test('invoke without id runs handler but returns null', async () => {
    let called = false;
    const host = createRpcHost();
    host.handle({
      name: 'tick',
      handler() {
        called = true;
      },
    });
    const result = await host.invoke(request({ method: 'tick' }), new AbortController().signal);
    expect(called).toBe(true);
    expect(result).toBeNull();
  });

  test('invoke unknown method returns method-not-found error', async () => {
    const host = createRpcHost();
    const result = await host.invoke(
      request({ method: 'ghost', id: 1 }),
      new AbortController().signal,
    );
    expect('error' in result!.response && result!.response.error.code).toBe(-32601);
  });

  test('invoke invalid params returns invalid-params error', async () => {
    const host = createRpcHost();
    host.handle({ name: 'double', input: z.number(), handler: n => n * 2 });
    const result = await host.invoke(
      request({ method: 'double', params: ['x'], id: 1 }),
      new AbortController().signal,
    );
    expect('error' in result!.response && result!.response.error.code).toBe(-32602);
  });

  test('invoke handler error surfaces code and message', async () => {
    const host = createRpcHost();
    host.handle({
      name: 'fail',
      handler() {
        throw Object.assign(new Error('nope'), { code: -32010 });
      },
    });
    const result = await host.invoke(
      request({ method: 'fail', id: 1 }),
      new AbortController().signal,
    );
    expect('error' in result!.response && result!.response.error).toMatchObject({
      code: -32010,
      message: 'nope',
    });
  });

  test('emit delivers to subscribed listeners', () => {
    const host = createRpcHost();
    const seen: unknown[] = [];
    const off = host.on('ping', event => seen.push(event.params));
    host.emit('ping', ['hi']);
    expect(seen).toEqual([['hi']]);
    off();
    host.emit('ping', ['again']);
    expect(seen).toEqual([['hi']]);
  });

  test('dispose blocks further invoke and clears state', async () => {
    const host = createRpcHost();
    host.handle({ name: 'echo', handler: (v: unknown) => v });
    host.dispose();
    expect(
      await host.invoke(request({ method: 'echo', id: 1 }), new AbortController().signal),
    ).toBeNull();
  });
});
