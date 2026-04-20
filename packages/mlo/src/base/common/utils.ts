import type { MloPluginObject } from '../../types/plugin.js'
import { inBrowser } from './env.js'

const OBJ_PROTO = Object.prototype
const ELEM_PROTO = inBrowser ? Element.prototype : null

const UnobservableTypes: string[] = [
  'string',
  'number',
  'boolean',
  'bigint',
  'undefined',
  'symbol',
]

export function isObservable(source: unknown): source is object | Function {
  return isUnobservable(source) === false
}

export function isUnobservable(source: unknown): boolean {
  return (
    isNil(source) ||
    source === globalThis ||
    UnobservableTypes.includes(typeof source)
  )
}

export function isPluginObject(plugin: unknown): plugin is MloPluginObject {
  return isObject<MloPluginObject>(plugin) && isFunction(plugin.setup)
}

export function isNil(o: unknown): o is null | undefined {
  return o === null || o === undefined
}

export function isObject<T extends object>(o: unknown): o is T {
  if (isNil(o) || Array.isArray(o) || isFunction(o)) {
    return false
  }

  return typeof o === 'object'
}

export function isFunction<T extends Function>(o: unknown): o is T {
  return typeof o === 'function'
}

export function isElement(o: unknown): o is Element {
  return o instanceof Element
}

export function noop() {
  return void 0
}

export function querySelector(
  selector?: string | Element | null,
  parent: Element | Document = document
): Element | null {
  if (typeof selector === 'string') {
    return parent.querySelector(selector)
  }

  if (selector instanceof Element) {
    return selector
  }

  return null
}

export function analyzePrototype(o: object) {
  const chain: string[] = []

  let current: object | null = Object.getPrototypeOf(o)

  while (current !== null && current !== OBJ_PROTO) {
    // Note: 如果是覆盖了原始类型，通过 __mlo_class__ 来标识原始类型的类名
    const className = (current as any).__mlo_class__

    if (className) {
      chain.unshift(className)
      break
    }

    const ctor = current.constructor
    const name = ctor?.name ?? 'Unknown'

    if (name === 'Object') break

    chain.push(name)

    if ((inBrowser && isElement(o)) || current === ELEM_PROTO) {
      chain.push('Element')
      break
    }

    current = Object.getPrototypeOf(current)
  }

  return [chain[0] || 'Object', chain.slice(1)] as const
}
