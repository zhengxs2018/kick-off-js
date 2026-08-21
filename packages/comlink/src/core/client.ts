import { createPendingQueue } from '../common/queue.js';
import { extractTransferables, isObject } from '../common/util.js';
import {
  isRpcEventMethod,
  rpcEvent,
  RPC_EVENT_CLOSE,
  RPC_EVENT_OPEN,
  type RpcEvent,
  type RpcRequest,
  type RpcSuccessResponse,
  type RpcErrorResponse,
  type RpcMessage,
} from './schema.js';
import { RpcError } from './error.js';
import type { RpcTransport } from './transport.js';

export function createRpcClient({
  name,
  transport,
  onClose,
  onEvent,
  onRequest,
}: RpcClientOptions): RpcClient {
  const controller = new AbortController();
  const queue = createPendingQueue();

  const abortSignal = controller.signal;

  transport.addEventListener('message', onMessage, { signal: abortSignal });

  emit(RPC_EVENT_OPEN, [{ name }]);

  return {
    name,
    call,
    notify,
    emit,
    dispose,
    get disposed() {
      return abortSignal.aborted;
    },
    [Symbol.dispose]() {
      dispose();
    },
  };

  function call<T = unknown>(
    method: string,
    params: unknown[] = [],
    options?: { signal?: AbortSignal },
  ): Promise<T> {
    if (abortSignal.aborted) {
      return Promise.reject(new DOMException('RPC client closed', 'AbortError'));
    }

    const id = crypto.randomUUID();
    const task = queue.create<T>(id);

    options?.signal?.addEventListener(
      'abort',
      function onCallAbort() {
        queue.reject(id, new DOMException('Call aborted', 'AbortError'));
      },
      { once: true },
    );

    try {
      transport.postMessage(
        { jsonrpc: '2.0', id, method, params } satisfies RpcRequest,
        extractTransferables(params),
      );
    } catch {
      queue.reject(id, new DOMException('Send failed', 'NetworkError'));
    }

    return task.promise;
  }

  function notify(method: string, params: unknown[] = []): boolean {
    if (abortSignal.aborted) return false;

    try {
      transport.postMessage(
        { jsonrpc: '2.0', method, params } satisfies RpcRequest,
        extractTransferables(params),
      );
      return true;
    } catch {
      return false;
    }
  }

  function emit(event: string, params: unknown[] = []): boolean {
    if (abortSignal.aborted) return false;

    try {
      transport.postMessage(rpcEvent(event, params), extractTransferables(params));
      return true;
    } catch {
      return false;
    }
  }

  function dispose(reason?: string): void {
    if (abortSignal.aborted) return;

    emit(RPC_EVENT_CLOSE, [{ name, reason }]);

    transport.removeEventListener('message', onMessage);

    const error = new DOMException(reason || 'RPC client closed', 'AbortError');

    controller.abort(error);
    queue.rejectAll(error);

    onClose();
  }

  function onMessage({ data }: MessageEvent): void {
    if (!(isObject<RpcMessage>(data) && data.jsonrpc === '2.0')) return;

    if ('method' in data) {
      const message = data as RpcRequest;

      if (message.id === undefined && isRpcEventMethod(message.method)) {
        onEvent?.(message as RpcEvent);
        return;
      }

      onRequest(message, transport);
      return;
    }

    if (!('id' in data) || data.id == null) return;

    if ('result' in data) {
      queue.resolve(data.id as string, (data as RpcSuccessResponse).result);
    } else if ('error' in data) {
      queue.reject(data.id as string, RpcError.fromResponse((data as RpcErrorResponse).error));
    }
  }
}

export interface RpcClientOptions {
  name: string;

  transport: RpcTransport;

  onRequest(request: RpcRequest, transport: RpcTransport): void;

  onEvent?(event: RpcEvent): void;

  onClose(): void;
}

export interface RpcClient {
  readonly name: string;

  readonly disposed: boolean;

  call<T = unknown>(
    method: string,
    params?: unknown[],
    options?: { signal?: AbortSignal },
  ): Promise<T>;

  notify(method: string, params?: unknown[]): boolean;

  emit(event: string, params?: unknown[]): boolean;

  dispose(reason?: string): void;

  [Symbol.dispose](): void;
}
