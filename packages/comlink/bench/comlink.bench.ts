import { bench, do_not_optimize, group, run } from 'mitata';
import { z } from 'zod';

import {
  createEmitter,
  createRpcHost,
  createRpcClient,
  rpcEvent,
  withEventPrefix,
  type RpcRequest,
} from '../src/index.js';
import { createRpcRegistry } from '../src/core/registry.js';
import { createPendingQueue } from '../src/common/queue.js';
import type { RpcTransport } from '../src/core/transport.js';
import type { RpcProcedure, RpcHandler } from '../src/core/schema.js';

group('emitter', () => {
  bench('on + emit (single listener)', () => {
    const emitter = createEmitter();
    const off = emitter.on('tick', () => {});
    emitter.emit('tick', undefined);
    off[Symbol.dispose]();
  });
});

group('event prefix', () => {
  bench('withEventPrefix', () => {
    do_not_optimize(withEventPrefix('custom'));
  });

  bench('rpcEvent construction', () => {
    do_not_optimize(rpcEvent('custom', [{ value: 1 }]));
  });
});

group('registry', () => {
  bench('register + get', () => {
    const registry = createRpcRegistry();
    const unregister = registry.register({
      name: `proc-${Math.random().toString(36).slice(2)}`,
      input: z.any(),
      handler: ((_args: unknown, _signal: AbortSignal) => undefined) as RpcHandler<z.ZodTypeAny>,
    } satisfies RpcProcedure<z.ZodTypeAny>);
    do_not_optimize(registry.get('proc'));
    unregister();
  });

  bench('lookup miss', () => {
    const registry = createRpcRegistry();
    do_not_optimize(registry.get('missing'));
  });
});

group('client notify', () => {
  const transport: RpcTransport = {
    postMessage() {},
    addEventListener() {},
    removeEventListener() {},
  };

  const client = createRpcClient({
    name: 'bench',
    transport,
    onRequest() {},
    onClose() {},
    onEvent() {},
  });

  bench('notify (in-memory transport)', () => {
    client.notify('tick', [{ value: 1 }]);
  });
});

group('emitter (multi-listener)', () => {
  bench('emit to 4 listeners', () => {
    const emitter = createEmitter();
    const offs = [
      emitter.on('tick', () => {}),
      emitter.on('tick', () => {}),
      emitter.on('tick', () => {}),
      emitter.on('tick', () => {}),
    ];
    emitter.emit('tick', undefined);
    offs.forEach(off => off[Symbol.dispose]());
  });

  bench('once + emit', () => {
    const emitter = createEmitter();
    const off = emitter.on('tick', () => {}, { once: true });
    emitter.emit('tick', undefined);
    off[Symbol.dispose]();
  });
});

group('pending queue', () => {
  bench('create + resolve', () => {
    const queue = createPendingQueue();
    const task = queue.create('id');
    queue.resolve('id', 42);
    do_not_optimize(task);
  });
});

group('request id', () => {
  bench('crypto.randomUUID', () => {
    do_not_optimize(crypto.randomUUID());
  });
});

group('client call', () => {
  const transport: RpcTransport = {
    postMessage() {},
    addEventListener() {},
    removeEventListener() {},
  };

  const client = createRpcClient({
    name: 'bench',
    transport,
    onRequest() {},
    onClose() {},
    onEvent() {},
  });

  bench('call (fire, no await)', () => {
    const task = client.call('tick', [{ value: 1 }]);
    do_not_optimize(task);
  });
});

group('host dispatch', () => {
  const host = createRpcHost();
  host.handle({
    name: 'echo',
    input: z.number(),
    handler: (n: number, _signal: AbortSignal) => n,
  });

  const signal = new AbortController().signal;
  const request: RpcRequest = { jsonrpc: '2.0', method: 'echo', params: [42], id: 1 };

  bench('invoke round-trip', async () => {
    await host.invoke(request, signal);
  });

  bench('concurrent invoke (x4)', async () => {
    await Promise.all([
      host.invoke(request, signal),
      host.invoke(request, signal),
      host.invoke(request, signal),
      host.invoke(request, signal),
    ]);
  });
});

await run();
