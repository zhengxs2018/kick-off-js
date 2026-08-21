import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { z } from 'zod';

import { createWebRpc, WEBRPC_EVENT_OPEN, WEBRPC_EVENT_CLOSE, type WebRpcEvent } from '../web.js';
import type { WebRpc } from '../web.js';
import { WEB_RPC_PROBE_FLAG, rpcEvent } from '../core/index.js';
import type { RpcTransport } from '../core/index.js';

import { getWindow } from './setup.js';

/** 用 Bun 原生 MessageChannel 建立两条互通的 transport 端点。 */
function createPortPair(): { a: MessagePort; b: MessagePort } {
  const { port1, port2 } = new MessageChannel();
  return { a: port1, b: port2 };
}

/** 进程内消息总线，用于向 web.ts 注入带前缀的 RPC 事件消息。 */
function createLoopbackTransport(): RpcTransport & { deliver(message: unknown): void } {
  const listeners = new Set<(e: MessageEvent) => void>();
  return {
    postMessage(message: unknown) {
      const event = new MessageEvent('message', { data: structuredClone(message) });
      queueMicrotask(() => {
        for (const l of [...listeners]) l(event);
      });
    },
    addEventListener(_t, l) {
      listeners.add(l as (e: MessageEvent) => void);
    },
    removeEventListener(_t, l) {
      listeners.delete(l as (e: MessageEvent) => void);
    },
    deliver(message: unknown) {
      const event = new MessageEvent('message', { data: structuredClone(message) });
      for (const l of [...listeners]) l(event);
    },
  };
}

function makeProbeEvent(source: MessagePort, origin = 'https://example.com'): MessageEvent {
  return new MessageEvent('message', { data: WEB_RPC_PROBE_FLAG, source, origin });
}

describe('createWebRpc', () => {
  let win: ReturnType<typeof getWindow>;

  beforeEach(() => {
    win = getWindow();
  });

  describe('start / stop 接线', () => {
    test('start 注册 message 监听，stop 移除', () => {
      const rpc = createWebRpc('host-a');
      const addSpy = spyOn(win, 'addEventListener');
      const removeSpy = spyOn(win, 'removeEventListener');

      rpc.start();
      expect(addSpy).toHaveBeenCalledWith('message', expect.any(Function), expect.any(Object));

      rpc.stop();
      expect(removeSpy).toHaveBeenCalledWith('message', expect.any(Function));

      rpc.dispose();
      addSpy.mockRestore();
      removeSpy.mockRestore();
    });

    test('start 幂等：重复调用只注册一次', () => {
      const rpc = createWebRpc('host-b');
      const addSpy = spyOn(win, 'addEventListener');

      rpc.start();
      rpc.start();
      // 一次 start 注册 message + beforeunload 两个监听，重复调用不应重复注册。
      expect(addSpy).toHaveBeenCalledTimes(2);

      rpc.dispose();
      addSpy.mockRestore();
    });
  });

  describe('onWindowMessage probe / trust', () => {
    test('收到 probe 后向可信源回 handshakeHello', () => {
      const rpc = createWebRpc('host-c');
      rpc.start();

      const source = new MessageChannel().port1;
      const postSpy = spyOn(source, 'postMessage');

      win.dispatchEvent(makeProbeEvent(source));

      expect(postSpy).toHaveBeenCalled();
      const payload = (postSpy as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]?.[0];
      expect(payload).toMatchObject({ handshake: true, name: 'host-c', version: '1.0' });

      rpc.dispose();
    });

    test('origin 不匹配的 probe 被标记为不可信，不回握手', () => {
      const rpc = createWebRpc('host-d', { origin: 'https://trusted.com' });
      rpc.start();

      const source = new MessageChannel().port1;
      const postSpy = spyOn(source, 'postMessage');

      win.dispatchEvent(makeProbeEvent(source, 'https://evil.com'));

      expect(postSpy).not.toHaveBeenCalled();
      rpc.dispose();
    });

    test('origin 函数返回 true 时回握手', () => {
      const rpc = createWebRpc('host-e', { origin: o => o === 'https://ok.com' });
      rpc.start();

      const source = new MessageChannel().port1;
      const postSpy = spyOn(source, 'postMessage');

      win.dispatchEvent(makeProbeEvent(source, 'https://ok.com'));
      expect(postSpy).toHaveBeenCalled();

      rpc.dispose();
    });

    test('重复 probe 同一可信源不再重复握手', () => {
      const rpc = createWebRpc('host-f');
      rpc.start();

      const source = new MessageChannel().port1;
      const postSpy = spyOn(source, 'postMessage');

      const evt = makeProbeEvent(source);
      win.dispatchEvent(evt);
      win.dispatchEvent(evt);

      expect(postSpy).toHaveBeenCalledTimes(1);
      rpc.dispose();
    });
  });

  describe('attach / invoke / send / peers', () => {
    let host: WebRpc;
    let peer: WebRpc;
    let portHost: MessagePort;
    let portPeer: MessagePort;

    beforeEach(() => {
      host = createWebRpc('host');
      peer = createWebRpc('peer');

      host.handle({ name: 'echo', input: z.unknown(), handler: v => v });
      host.handle({
        name: 'add',
        input: z.tuple([z.number(), z.number()]),
        handler: ([a, b]) => a + b,
      });

      const pair = createPortPair();
      portHost = pair.a;
      portPeer = pair.b;

      host.attach('peer', portHost);
      peer.attach('host', portPeer);
    });

    afterEach(() => {
      host.dispose();
      peer.dispose();
    });

    test('attach 后两端互相出现在 peers', () => {
      expect(host.peers()).toContain('peer');
      expect(peer.peers()).toContain('host');
    });

    test('peer 通过 attach 的 transport 调用 host procedure', async () => {
      await expect(peer.invoke<number>('host', 'add', [[2, 3]])).resolves.toBe(5);
    });

    test('host 调用 peer procedure 经双向 transport', async () => {
      peer.handle({ name: 'pong', input: z.unknown(), handler: v => ({ echoed: v }) });
      await expect(host.invoke<{ echoed: unknown }>('peer', 'pong', ['hi'])).resolves.toEqual({
        echoed: 'hi',
      });
    });

    test('send 向已连接 peer 投递 notify 且对端 handler 收到入参', async () => {
      const received: unknown[] = [];
      peer.handle({
        name: 'note',
        input: z.unknown(),
        handler: v => {
          received.push(v);
        },
      });

      const sent = host.notify('peer', 'note', [{ ping: true }]);
      expect(sent).toBe(true);

      await new Promise(r => setTimeout(r, 10));
      expect(received).toEqual([{ ping: true }]);
    });

    test('invoke 到未知 peer 拒绝 NetworkError', async () => {
      const rpc = createWebRpc('lonely');
      const err = await rpc.invoke('ghost', 'x', []).then(
        () => null,
        e => e,
      );
      expect(err).toBeInstanceOf(DOMException);
      expect((err as DOMException).name).toBe('NetworkError');
      rpc.dispose();
    });
  });

  describe('open / close 生命周期事件', () => {
    test('attach 触发 open，对端 dispose 触发本端 close', async () => {
      const host = createWebRpc('hub');
      const peer = createWebRpc('node');
      const opened: string[] = [];
      const closed: string[] = [];

      host.on(WEBRPC_EVENT_OPEN, e => opened.push((e.params[0] as { name: string }).name));
      host.on(WEBRPC_EVENT_CLOSE, e => closed.push((e.params[0] as { name: string }).name));

      const pair = createPortPair();
      host.attach('node', pair.a);
      peer.attach('hub', pair.b);
      expect(opened).toEqual(['node']);

      peer.dispose();
      await new Promise(r => setTimeout(r, 10));
      expect(closed).toEqual(['hub']);

      host.dispose();
    });
  });

  describe('handle / on 事件接线', () => {
    test('on 订阅 host 事件，对端注入带前缀事件触发 listener', async () => {
      const rpc = createWebRpc('evt-host');
      const events: WebRpcEvent[] = [];
      const off = rpc.on('custom', e => events.push(e));

      const transport = createLoopbackTransport();
      rpc.attach('evt-peer', transport);

      transport.deliver(rpcEvent('custom', [{ v: 1 }]));
      await new Promise(r => setTimeout(r, 10));

      expect(events).toHaveLength(1);
      expect(events[0]?.method).toBe('custom');
      expect(events[0]?.params).toEqual([{ v: 1 }]);

      off();
      rpc.dispose();
    });

    test('on 返回的函数可注销订阅', async () => {
      const rpc = createWebRpc('evt-host-2');
      const events: WebRpcEvent[] = [];
      const off = rpc.on('custom', e => events.push(e));

      const transport = createLoopbackTransport();
      rpc.attach('evt-peer', transport);

      off();
      transport.deliver(rpcEvent('custom', [{ v: 1 }]));
      await new Promise(r => setTimeout(r, 10));

      expect(events).toHaveLength(0);
      rpc.dispose();
    });
  });
});
