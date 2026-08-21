import type { z } from 'zod';

import { extractTransferables } from '../common/util.js';
import { createEmitter } from '../common/emitter.js';
import { createRpcRegistry, type RpcRegistry } from './registry.js';
import { RpcError } from './error.js';
import { withEventPrefix, rpcEvent } from './schema.js';
import type {
  RpcEvent,
  RpcEventListener,
  RpcProcedure,
  RpcRequest,
  RpcSuccessResponse,
  RpcErrorResponse,
  RpcId,
} from './schema.js';

export function createRpcHost(): RpcHost {
  const registry: RpcRegistry = createRpcRegistry();
  const emitter = createEmitter();

  let disposed = false;

  return {
    handle,
    on,
    emit,
    invoke,
    dispose,
    [Symbol.dispose]() {
      dispose();
    },
  };

  function handle<T extends z.ZodTypeAny>(proc: RpcProcedure<T>): () => void {
    return registry.register(proc);
  }

  function on(event: string, listener: RpcEventListener): () => void {
    const subscription = emitter.on(withEventPrefix(event), (data: unknown) =>
      listener(data as RpcEvent),
    );
    return () => subscription[Symbol.dispose]();
  }

  function emit(event: string, params: unknown[] = []): void {
    if (disposed) return;

    emitter.emit(withEventPrefix(event), rpcEvent(event, params));
  }

  async function invoke(
    request: RpcRequest,
    signal: AbortSignal,
  ): Promise<RpcDispatchResult | null> {
    if (disposed) return null;

    if (request.id === undefined) {
      const proc = registry.get(request.method);
      if (!proc) return null;

      const input = proc.input
        ? proc.input.safeParse(request.params[0])
        : { success: true as const, data: undefined };

      if (!input.success) return null;

      try {
        await proc.handler(input.data, signal);
      } catch {}
      return null;
    }

    const proc = registry.get(request.method);
    if (!proc) return buildError(request.id, -32601, `Method not found: ${request.method}`);

    const input = proc.input
      ? proc.input.safeParse(request.params[0])
      : { success: true as const, data: undefined };

    if (!input.success)
      return buildError(request.id, -32602, `Invalid params: ${input.error.message}`);

    try {
      if (signal.aborted) return buildError(request.id, -32001, 'Request aborted');
      const result = await proc.handler(input.data, signal);
      return {
        response: { jsonrpc: '2.0', id: request.id, result },
        transfer: extractTransferables(result),
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (error instanceof RpcError) {
        return buildError(request.id, error.code, error.message, error.data);
      }
      return buildError(request.id, -32000, error.message);
    }
  }

  function dispose(): void {
    disposed = true;
    registry.clear();
    emitter[Symbol.dispose]();
  }
}

export interface RpcDispatchResult {
  response: RpcSuccessResponse | RpcErrorResponse;
  transfer: Transferable[];
}

export interface RpcHost {
  handle<T extends z.ZodTypeAny>(proc: RpcProcedure<T>): () => void;

  on(event: string, listener: RpcEventListener): () => void;

  emit(event: string, params?: unknown[]): void;

  invoke(request: RpcRequest, signal: AbortSignal): Promise<RpcDispatchResult | null>;

  dispose(): void;

  [Symbol.dispose](): void;
}

function buildError(id: RpcId, code: number, message: string, data?: unknown): RpcDispatchResult {
  return {
    response: { jsonrpc: '2.0', id, error: { code, message, data } },
    transfer: [],
  };
}
