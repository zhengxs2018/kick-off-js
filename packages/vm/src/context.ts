import type { Dict } from '@zhengxs/shared'

// Note: 防止在嵌套的情况下，window 变量被覆盖
const globalThis = (0, eval)('window')
const contextSymbolKey = Symbol('sandbox#context')

export interface Context extends Dict {}

export function isContext(o: unknown): o is Context {
  return !!o && (o as any)[contextSymbolKey] === true
}

export type ContextProxyHandler = {
  has(prop: string | symbol): boolean
  get(prop: string | symbol): any
  set(prop: string | symbol, value: any): boolean | undefined
}

export function createContext(
  contextifiedObject: object | undefined,
  handler: ContextProxyHandler = noopProxyHander
): Context {
  const context = Object.create(contextifiedObject || null)

  const proxy = new Proxy(context, {
    has(target, prop) {
      return handler.has(prop) || Reflect.has(target, prop)
    },
    get(target, prop) {
      if (prop === Symbol.unscopables) {
        return globalThis
      }

      if (handler.has(prop)) {
        return handler.get(prop)
      }

      if (Reflect.has(target, prop)) {
        return target[prop]
      }
    },
    set(target, prop, value) {
      if (!handler.set(prop, value)) {
        target[prop] = value
      }

      return true
    },
  })

  Object.defineProperties(context, {
    proxy: {
      value: proxy,
      writable: false,
      configurable: false,
      enumerable: false,
    },
    [contextSymbolKey]: {
      value: true,
      writable: false,
      configurable: false,
      enumerable: false,
    },
  })

  return context
}

const noopProxyHander: ContextProxyHandler = {
  has() {
    return false
  },
  get() {},
  set() {
    return false
  },
}
