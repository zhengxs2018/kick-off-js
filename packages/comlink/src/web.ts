import type { z } from 'zod';
import { createRpcHost, type RpcHost, type RpcDispatchResult } from './core/index.js';
import { createRpcClient, type RpcClient } from './core/index.js';
import { isHandshakeHello, handshakeHello, WEB_RPC_PROBE_FLAG } from './core/index.js';
import {
  RPC_EVENT_PREFIX,
  type RpcEvent,
  type RpcProcedure,
  type RpcRequest,
} from './core/index.js';
import type { RpcTransport } from './core/index.js';

export const WEBRPC_EVENT_OPEN = 'open';
export const WEBRPC_EVENT_CLOSE = 'close';

export interface WebRpcEvent {
  readonly method: string;
  readonly params: unknown[];
}

export function createWebRpc(name: string, options?: WebRpcOptions): WebRpc {
  const controller = new AbortController();

  const clients = new Map<string, RpcClient>();
  const trustedSources = new WeakSet<MessageEventSource>();
  const untrustedSources = new WeakSet<MessageEventSource>();

  const host: RpcHost = createRpcHost();

  const shouldTrustOrigin = buildTrustOriginCheck(options);

  let started = false;

  return {
    name,
    on,
    start,
    stop,
    attach,
    connect,
    handle,
    invoke,
    notify,
    peers,
    dispose,
    [Symbol.dispose]() {
      dispose();
    },
  };

  function on(method: string, listener: (event: WebRpcEvent) => void): () => void {
    return host.on(method, (e: RpcEvent) => {
      listener({ method: e.method.slice(RPC_EVENT_PREFIX.length), params: e.params });
    });
  }

  function start(): void {
    if (started) return;
    started = true;

    window.addEventListener('message', onWindowMessage, { signal: controller.signal });
    window.addEventListener('beforeunload', onWindowBeforeUnload, {
      once: true,
      passive: true,
      signal: controller.signal,
    });
  }

  function stop(): void {
    if (!started) return;
    started = false;

    window.removeEventListener('message', onWindowMessage);
    window.removeEventListener('beforeunload', onWindowBeforeUnload);
  }

  function handle<T extends z.ZodTypeAny>(proc: RpcProcedure<T>): () => void {
    return host.handle(proc);
  }

  function connect(source: WindowProxy, options?: { signal?: AbortSignal }): Promise<RpcClient> {
    if (untrustedSources.has(source)) {
      return Promise.reject(new DOMException('Untrusted source', 'SecurityError'));
    }

    const { promise, resolve, reject } = Promise.withResolvers<RpcClient>();

    // 合并实例级与调用级信号：无 options.signal 时退化为 controller.signal，
    // 始终以同一 options 引用注册/注销，保证 add/remove 严格匹配且受 abort 控制。
    const signals: AbortSignal[] = [controller.signal];
    if (options?.signal) signals.push(options.signal);
    const signal = AbortSignal.any(signals);
    const listenerOptions: AddEventListenerOptions = { signal };

    signal.addEventListener('abort', onAbort, { once: true });

    // 先注册握手监听器，再发送 PROBE，确保接收端就绪后才触发对方响应。
    window.addEventListener('message', onHandshake, listenerOptions);
    source.postMessage(WEB_RPC_PROBE_FLAG, '*');

    return promise.finally(() => {
      window.removeEventListener('message', onHandshake, listenerOptions);
      signal.removeEventListener('abort', onAbort);
    });

    function onHandshake(event: MessageEvent): void {
      if (event.source !== source) return;
      if (isHandshakeHello(event.data)) {
        const { port1, port2 } = new MessageChannel();

        source.postMessage(handshakeHello(name), event.origin, [port2]);

        resolve(attach(event.data.name, port1));
        return;
      }
    }

    function onAbort(): void {
      reject(new DOMException('Connection aborted', 'AbortError'));
    }
  }

  function attach(name: string, transport: RpcTransport): RpcClient {
    const existing = clients.get(name);
    if (existing && !existing.disposed) return existing;

    transport.start?.();

    const client = createRpcClient({
      name,
      transport,
      onRequest(request: RpcRequest, transport: RpcTransport): void {
        void host.invoke(request, controller.signal).then(function sendResult(
          result: RpcDispatchResult | null,
        ) {
          if (result) transport.postMessage(result.response, result.transfer);
        });
      },
      onEvent(event: RpcEvent): void {
        host.emit(event.method, event.params);
      },
      onClose() {
        clients.delete(name);
        host.emit(WEBRPC_EVENT_CLOSE, [{ name }]);
      },
    });

    clients.set(name, client);
    host.emit(WEBRPC_EVENT_OPEN, [{ name }]);

    return client;
  }

  function invoke<T = unknown>(
    name: string,
    method: string,
    params?: unknown[],
    options?: { signal?: AbortSignal },
  ): Promise<T> {
    const client = clients.get(name);

    if (client) {
      return client.call(method, params, options);
    }

    return Promise.reject(new DOMException(`No connection to "${name}"`, 'NetworkError'));
  }

  function notify(channel: string, method: string, params?: unknown[]): boolean {
    const client = clients.get(channel);
    return client ? client.notify(method, params) : false;
  }

  function peers(): string[] {
    return Array.from(clients.keys());
  }

  function dispose(reason?: string): void {
    if (controller.signal.aborted) return;
    controller.abort(new DOMException(reason || 'WebRpc disposed', 'AbortError'));

    started = false;

    host.dispose();

    for (const client of clients.values()) {
      client.dispose();
    }

    clients.clear();
  }

  function onWindowMessage(event: MessageEvent): void {
    const source = event.source;

    if (!source || untrustedSources.has(source)) return;

    if (event.data === WEB_RPC_PROBE_FLAG) {
      if (trustedSources.has(source)) return;

      if (!shouldTrustOrigin(event.origin)) {
        untrustedSources.add(source);
        return;
      }

      try {
        (source as Window).postMessage(handshakeHello(name), { targetOrigin: event.origin });
        trustedSources.add(source);
      } catch {
        untrustedSources.add(source);
      }
      return;
    }

    if (!trustedSources.has(source)) return;

    if (isHandshakeHello(event.data) && event.ports.length > 0) {
      attach(event.data.name, event.ports[0]!);
    }
  }

  function onWindowBeforeUnload(): void {
    for (const client of clients.values()) {
      client.dispose();
    }
  }
}

export interface WebRpcOptions {
  origin?: string | TrustOriginCheck;
}

export interface WebRpc {
  /**
   * The name of the WebRpc instance, used for identification in handshakes and connections.
   */
  readonly name: string;

  /**
   * Starts listening for incoming connections.
   */
  start(): void;

  /**
   * Stops listening for incoming connections and disposes all clients.
   */
  stop(): void;

  /**
   * Attaches a procedure to the host.
   *
   * @param proc - The procedure to attach.
   * @returns A function that can be called to detach the procedure.
   */
  handle<T extends z.ZodTypeAny>(proc: RpcProcedure<T>): () => void;

  /**
   * Subscribes to a remote event. The `rpc.` channel prefix is added internally,
   * so callers pass the bare method name. The listener receives the event's
   * method and params as delivered by the remote peer.
   *
   * @param method - The event method name, e.g. `'chat'`.
   * @param listener - The listener invoked with `{ method, params }`.
   * @returns A function that can be called to unsubscribe.
   */
  on(method: string, listener: (event: WebRpcEvent) => void): () => void;

  /**
   * Attaches a remote host and returns a client for communication.
   *
   * @param name - The name of the remote host.
   * @param transport - The transport to use for communication
   * @returns A connected client.
   */
  attach(name: string, transport: RpcTransport): RpcClient;

  /**
   * Connects to a remote host and returns a client for communication.
   *
   * @param source - The source window to connect to.
   * @param options - Optional connection options.
   * @returns A promise that resolves to a connected client.
   */
  connect(source: WindowProxy, options?: { signal?: AbortSignal }): Promise<RpcClient>;

  /**
   * Invokes a remote procedure on a connected client.
   *
   * @param name - The name of the remote client.
   * @param method - The name of the remote procedure to invoke.
   * @param params - Optional parameters to pass to the remote procedure.
   * @param options - Optional invocation options.
   * @returns A promise that resolves to the result of the remote procedure.
   */
  invoke<T = unknown>(
    name: string,
    method: string,
    params?: unknown[],
    options?: { signal?: AbortSignal },
  ): Promise<T>;

  /**
   * Broadcasts a notification to a connected peer without expecting a response.
   *
   * @param name - The name of the connected peer.
   * @param method - The event method name.
   * @param params - Optional parameters delivered to the peer.
   * @returns `true` if the peer exists and the notification was dispatched.
   */
  notify(name: string, method: string, params?: unknown[]): boolean;

  /**
   * Returns a list of names of all connected clients.
   *
   * @returns An array of connected client names.
   */
  peers(): string[];

  /**
   * Disposes the WebRpc instance, stopping all connections and cleaning up resources.
   *
   * @param reason - Optional reason for disposal.
   */
  dispose(reason?: string): void;

  [Symbol.dispose](): void;
}

export type TrustOriginCheck = (targetOrigin: string) => boolean;

function buildTrustOriginCheck(options?: WebRpcOptions): TrustOriginCheck {
  const origin = options?.origin ?? '*';

  if (typeof origin === 'function') {
    return origin;
  }

  return function checkOrigin(targetOrigin: string): boolean {
    return origin === '*' || targetOrigin === origin;
  };
}
