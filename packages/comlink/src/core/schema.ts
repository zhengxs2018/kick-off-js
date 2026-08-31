import { z } from 'zod';

export interface RpcRequestOptions {
  signal?: AbortSignal;
  stream?: boolean;
  once?: boolean;
  node?: string;
}

export type RpcId = string | number | null;

const BaseMessageSchema = z.object({ jsonrpc: z.literal('2.0') });

export const RpcRequestSchema = BaseMessageSchema.extend({
  method: z.string().min(1),
  params: z.array(z.unknown()).max(2).default([]),
  id: z.union([z.string(), z.number()]).optional(),
});

export const RpcSuccessResponseSchema = BaseMessageSchema.extend({
  id: z.union([z.string(), z.number(), z.null()]),
  result: z.unknown(),
});

export const RpcErrorResponseSchema = BaseMessageSchema.extend({
  id: z.union([z.string(), z.number(), z.null()]),
  error: z.object({
    code: z.number(),
    message: z.string(),
    data: z.unknown().optional(),
  }),
});

export const RPC_EVENT_PREFIX = 'rpc.';

export const RPC_EVENT_OPEN = 'rpc.open';

export const RPC_EVENT_CLOSE = 'rpc.close';

export const RpcEventSchema = BaseMessageSchema.extend({
  method: z.string().startsWith(RPC_EVENT_PREFIX),
  params: z.array(z.unknown()).max(2).default([]),
});

export const RpcMessageSchema = z.discriminatedUnion('jsonrpc', [
  RpcRequestSchema,
  RpcSuccessResponseSchema,
  RpcErrorResponseSchema,
]);

export type RpcRequest = z.infer<typeof RpcRequestSchema>;
export type RpcSuccessResponse = z.infer<typeof RpcSuccessResponseSchema>;
export type RpcErrorResponse = z.infer<typeof RpcErrorResponseSchema>;
export type RpcMessage = z.infer<typeof RpcMessageSchema>;
export type RpcEvent = z.infer<typeof RpcEventSchema>;

export function rpcEvent(name: string, params: unknown[] = []): RpcEvent {
  return { jsonrpc: '2.0', method: withEventPrefix(name), params };
}

export function isRpcEventMethod(method: string): boolean {
  return method.startsWith(RPC_EVENT_PREFIX);
}

export function withEventPrefix(name: string): string {
  return isRpcEventMethod(name) ? name : `${RPC_EVENT_PREFIX}${name}`;
}

export type RpcEventListener = (event: RpcEvent) => void;

export type RpcHandler<TArgs extends z.ZodTypeAny = z.ZodVoid> = (
  input: z.infer<TArgs>,
  signal: AbortSignal,
) => MaybePromise<unknown>;

type MaybePromise<T> = T | Promise<T>;

export interface RpcProcedure<TArgs extends z.ZodTypeAny = z.ZodVoid> {
  readonly name: string;
  readonly input?: TArgs;
  readonly handler: RpcHandler<TArgs>;
}
