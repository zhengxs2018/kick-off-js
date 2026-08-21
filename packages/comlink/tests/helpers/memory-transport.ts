import type { RpcTransport } from '../core/transport.js';

interface WireListener {
  listener: (event: MessageEvent) => void;
  options: AddEventListenerOptions | undefined;
}

/**
 * 进程内双向消息总线，连接两个 RpcTransport 端点。
 *
 * 用于集成测试：一端 postMessage 会通过微任务异步投递到对端 addEventListener 注册的 listener，
 * 模拟 Window/MessagePort 的异步消息语义，无需真实 DOM 或 Worker。
 */
export function createMemoryPipe(): { local: RpcTransport; remote: RpcTransport } {
  const local = createEndpoint();
  const remote = createEndpoint();

  local.connect(remote);
  remote.connect(local);

  return { local, remote };
}

function createEndpoint(): RpcTransport & {
  connect(peer: RpcTransport & { deliver(event: MessageEvent): void }): void;
  deliver(event: MessageEvent): void;
} {
  const listeners = new Set<WireListener>();
  let peer: (RpcTransport & { deliver(event: MessageEvent): void }) | null = null;

  return {
    connect(target) {
      peer = target;
    },

    postMessage(message: unknown) {
      if (!peer) throw new Error('MemoryTransport: peer not connected');
      const event = new MessageEvent('message', { data: structuredClone(message) });
      queueMicrotask(() => peer?.deliver(event));
    },

    addEventListener(_type, listener, options) {
      listeners.add({ listener, options });
    },

    removeEventListener(_type, listener) {
      for (const entry of listeners) {
        if (entry.listener === listener) listeners.delete(entry);
      }
    },

    deliver(event: MessageEvent) {
      for (const { listener } of [...listeners]) {
        listener(event);
      }
    },
  };
}
