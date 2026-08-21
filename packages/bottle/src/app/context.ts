import { AsyncLocalStorage } from 'node:async_hooks';
import type { IncomingMessage, ServerResponse } from 'node:http';

import type { AppContext, DisposableLike } from '../base/common/types.js';
import { toWebRequest } from '../base/node/request.js';
import { isWritableResponse } from '../base/node/response.js';

export const contextStore = new AsyncLocalStorage<Context>();

export function createContext(contextObject: AppContext) {
  const ctx = Object.create(contextObject, {
    writable: {
      get() {
        return !ctx.respond && isWritableResponse(ctx.res);
      },
    },
  });

  const [url, request] = toWebRequest(ctx.req);

  ctx.url = url;
  ctx.request = request;

  ctx.subscriptions = [];

  return ctx as Context;
}

export function runInContext<R>(contextObject: AppContext, callback: (context: Context) => R) {
  const context = createContext(contextObject);
  return contextStore.run(context, callback, context);
}

export function useContext() {
  const context = contextStore.getStore();

  if (!context) {
    throw new Error('Request context store is not available');
  }

  return context;
}

export interface Context extends AppContext {
  url: URL;
  request: Request;

  writable: boolean;
  respond?: boolean;

  req: IncomingMessage;
  res: ServerResponse<IncomingMessage>;

  provides: Record<PropertyKey, unknown>;
  subscriptions: DisposableLike[];
}
