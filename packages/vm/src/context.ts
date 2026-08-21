import { hasOwn } from '@zhengxs/shared';

// Note: 防止在嵌套的情况下，window 变量被覆盖
const globalThis = (0, eval)('window');

const contextSymbolKey = Symbol('context');

export type Context = Record<PropertyKey, unknown>;

export function isContext(o: object): o is Context {
  return hasOwn(o, contextSymbolKey);
}

export function createContext<T extends object>(contextifiedObject: Context): Context & T {
  const context = (contextifiedObject || {}) as T & Context;

  const proxy = new Proxy(context, {
    has(target, prop) {
      return hasOwn(target, prop);
    },
    get(target, prop, receiver) {
      if (prop === Symbol.unscopables) {
        return globalThis;
      }

      return target[prop];
    },
    set(target, prop, newValue, receiver) {
      // @ts-expect-error ignore type error
      target[prop] = newValue;
      return true;
    },
  });

  Object.defineProperties(context, {
    [contextSymbolKey]: {
      value: true,
      enumerable: false,
      writable: false,
      configurable: false,
    },
    proxy: {
      value: proxy,
      enumerable: false,
      writable: false,
      configurable: false,
    },
  });

  return context;
}

export function createContextProxy<T extends object>(
  contextifiedObject: Context,
  handler: ContextProxyHandler<T>,
): Context & T {
  const context = (contextifiedObject || {}) as T & Context;

  const proxy = new Proxy(context, {
    has(target, prop) {
      return handler.has(target, prop) || hasOwn(target, prop);
    },
    get(target, prop, receiver) {
      if (prop === Symbol.unscopables) {
        return globalThis;
      }

      if (handler.has(target, prop)) {
        return handler.get(target, prop, receiver);
      }

      return target[prop];
    },
    set(target, prop, newValue, receiver) {
      if (handler.set(target, prop, newValue, receiver)) {
        return true;
      }

      // @ts-expect-error ignore type error
      target[prop] = newValue;

      return true;
    },
  });

  Object.defineProperties(context, {
    [contextSymbolKey]: {
      value: true,
      enumerable: false,
      writable: false,
      configurable: false,
    },
    proxy: {
      value: proxy,
      enumerable: false,
      writable: false,
      configurable: false,
    },
  });

  return context;
}

export type ContextProxyHandler<T extends object> = Required<
  Pick<ProxyHandler<T>, 'has' | 'get' | 'set'>
>;
