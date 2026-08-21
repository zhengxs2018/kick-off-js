import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { z } from 'zod';

import { createRpcClient } from '../core/client.js';
import { createRpcHost } from '../core/host.js';
import { RpcError } from '../core/error.js';
import type { RpcClient, RpcHost } from '../core/index.js';
import type { RpcEvent, RpcRequest } from '../core/schema.js';
import { isRpcEventMethod, RPC_EVENT_PREFIX } from '../core/schema.js';
import { isObject } from '../common/util.js';
import type { RpcTransport } from '../core/transport.js';

import { createMemoryPipe } from '../helpers/memory-transport.js';

/**
 * 集成测试：将 createRpcClient 与 createRpcHost 通过内存管道连接，
 * 验证 call / notify / emit / 事件订阅 / 错误码 的端到端行为。
 */
describe('client <-> host integration', () => {
  let local: RpcTransport;
  let remote: RpcTransport;
  let client: RpcClient;
  let host: RpcHost;

  beforeEach(() => {
    const pipe = createMemoryPipe();
    local = pipe.local;
    remote = pipe.remote;

    host = createRpcHost();
    host.handle({ name: 'echo', input: z.unknown(), handler: input => input });
    host.handle({
      name: 'add',
      input: z.tuple([z.number(), z.number()]),
      handler: ([a, b]) => a + b,
    });
    host.handle({
      name: 'boom',
      handler: () => {
        throw Object.assign(new Error('kaboom'), { code: -32099 });
      },
    });

    // 服务端循环：监听 host 侧 transport，将请求转交 host.invoke 并回写响应，
    // 将事件消息转交 host.emit。这是 client <-> host 单向 RPC 端到端打通的关键接线。
    const controller = new AbortController();
    remote.addEventListener(
      'message',
      ({ data }) => {
        if (!isObject(data) || data.jsonrpc !== '2.0') return;
        if (typeof data.method !== 'string') return;
        if (isRpcEventMethod(data.method)) {
          host.emit(data.method.slice(RPC_EVENT_PREFIX.length), (data as RpcEvent).params);
          return;
        }
        void host.invoke(data as RpcRequest, controller.signal).then(result => {
          if (result) remote.postMessage(result.response, result.transfer);
        });
      },
      { signal: controller.signal },
    );

    client = createRpcClient({
      name: 'client',
      transport: local,
      onClose() {},
      onRequest(request: RpcRequest, transport: RpcTransport) {
        void host.invoke(request, new AbortController().signal).then(result => {
          if (!result) return;
          transport.postMessage(result.response, result.transfer);
        });
      },
    });
  });

  afterEach(() => {
    client.dispose();
    host.dispose();
  });

  test('call returns the handler result', async () => {
    await expect(client.call<number>('add', [[2, 3]])).resolves.toBe(5);
  });

  test('call echoes unknown input', async () => {
    await expect(client.call('echo', [{ hello: 'world' }])).resolves.toEqual({ hello: 'world' });
  });

  test('call to unknown method rejects with method-not-found error', async () => {
    const err = await client.call('missing', []).then(
      () => null,
      e => e,
    );
    expect(err).toBeInstanceOf(RpcError);
    expect((err as RpcError).code).toBe(-32601);
  });

  test('call with invalid params rejects with invalid-params error', async () => {
    const err = await client.call<number>('add', [['x', 'y']]).then(
      () => null,
      e => e,
    );
    expect(err).toBeInstanceOf(RpcError);
    expect((err as RpcError).code).toBe(-32602);
  });

  test('call rejecting handler surfaces custom error code', async () => {
    const err = await client.call('boom', []).then(
      () => null,
      e => e,
    );
    expect(err).toBeInstanceOf(RpcError);
    expect((err as RpcError).code).toBe(-32099);
    expect(err.message).toBe('kaboom');
  });

  test('call after dispose rejects with AbortError', async () => {
    client.dispose();
    const err = await client.call('echo', [1]).then(
      () => null,
      e => e,
    );
    expect(err).toBeInstanceOf(DOMException);
    expect((err as DOMException).name).toBe('AbortError');
  });

  test('notify delivers to host and runs handler without response', async () => {
    let got: unknown = 'unset';
    host.handle({
      name: 'notify-probe',
      input: z.unknown(),
      handler: value => {
        got = value;
      },
    });
    client.notify('notify-probe', [{ ping: true }]);
    await new Promise(r => setTimeout(r, 10));
    expect(got).toEqual({ ping: true });
  });

  test('emit from client triggers host event listener', async () => {
    const events: RpcEvent[] = [];
    const off = host.on('custom', event => events.push(event));
    client.emit('custom', [{ value: 1 }]);
    await new Promise(r => setTimeout(r, 10));
    expect(events).toHaveLength(1);
    expect(events[0]?.params).toEqual([{ value: 1 }]);
    off();
  });

  test('dispose fires close event to host', async () => {
    const events: RpcEvent[] = [];
    host.on('close', event => events.push(event));
    client.dispose('bye');
    await new Promise(r => setTimeout(r, 10));
    expect(events.some(e => e.method.endsWith('close'))).toBe(true);
  });
});
