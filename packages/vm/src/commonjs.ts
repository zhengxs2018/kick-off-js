import { createContext } from './context.js'

export type RequireContext<Exports extends object, Context extends object> = {
  module: Exports
} & Context

export function createRequireContext<
  Exports extends object,
  Context extends object
>(contextifiedObject?: Context) {
  const mod = { exports: {} }

  const context = createContext(contextifiedObject, {
    has(prop: string) {
      if (prop === 'module') {
        return true
      }

      if (prop === 'exports') {
        return true
      }

      return Reflect.has(mod.exports, prop)
    },
    get(prop: string) {
      if (prop === 'module') {
        return mod
      }

      if (prop === 'exports') {
        return mod.exports
      }

      // @ts-expect-error ignore the type error
      return mod.exports[prop]
    },
    set(prop: string, value: object) {
      if (prop === 'exports') {
        mod.exports = value
        return true
      }

      return false
    },
  })

  Object.defineProperty(context, 'module', {
    get() {
      return mod.exports
    },
    configurable: false,
    enumerable: false,
  })

  return context as RequireContext<Exports, Context>
}
