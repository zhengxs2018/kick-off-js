import { ref } from './base/plugin-api/ref.js'
import {
  ObjectSources,
  ObjectRefs,
  ObjectRegistry,
} from './base/plugin-api/store.js'
import { createEvent, disposeAll } from './base/plugin-api/event.js'
import { isPluginObject, noop } from './base/common/utils.js'
import type { MloRef } from './types/ref.js'
import type { MloObject } from './types/object.js'
import type {
  MloPlugin,
  MloExtractPluginOptions,
  MloPluginObject,
} from './types/plugin.js'
import type { DisposeLike } from './types/event.js'
import { constant, getter, readonly } from './base/index.js'
import type { MloInstance } from './types/mlo.js'
import type { MloData, MloStats } from './types/snapshot.js'

const state = {
  disposed: false,
}

const plugins = new Set<MloPlugin>()

const subscriptions: Array<DisposeLike | (() => void)> = [
  () => {
    for (const ref of values()) {
      if (!ref.disposed) ref.dispose()
    }
  },
]

export const mlo: MloInstance = Object.create(null, {
  disposed: getter(() => state.disposed),
  events: readonly({
    onElementAdded: createEvent<Element>('element:added'),
    onElementRemoved: createEvent<Element>('element:removed'),
    onObjectObserve: createEvent<MloRef>('object:observe'),
    onObjectObserved: createEvent<MloRef>('object:observed'),
    onObjectUnobserved: createEvent<MloRef>('object:unobserved'),
    onObjectCollected: createEvent<MloRef>('object:collected'),
  }),
  use: constant(use),
  get: constant(get),
  key: constant(key),
  values: constant(values),
  observe: constant(observe),
  unobserve: constant(unobserve),
  flush: constant(flush),
  toString: constant(toString),
  toJSON: constant(toJSON),
  takeRecords: constant(takeRecords),
  dispose: constant(dispose),
  [Symbol.toPrimitive]: constant(toString),
  [Symbol.toStringTag]: constant('MLO'),
  [Symbol.dispose]: constant(dispose),
  [Symbol.iterator]: constant(values),
})

function use(plugin: MloPlugin, options?: object): void
function use<P extends MloPlugin>(
  plugin: P,
  options?: MloExtractPluginOptions<P>
): void {
  throwIfDisposed('use')

  if (plugins.has(plugin)) return

  plugins.add(plugin)

  if (typeof plugin === 'function') {
    ;(plugin as unknown as MloPluginObject) = plugin(options || {})
  }

  if (isPluginObject(plugin)) {
    ;(plugin as unknown as MloPluginObject).setup({ subscriptions })
  }
}

function get<T extends object>(source: T): MloRef<T> | undefined {
  return state.disposed
    ? undefined
    : (ObjectSources.get(source) as MloRef<T> | undefined)
}

function key<T extends object>(id: number): MloRef<T> | undefined {
  return state.disposed
    ? undefined
    : (ObjectRefs.get(id) as MloRef<T> | undefined)
}

function observe(source: null | undefined): undefined
function observe(source: string | number | boolean | bigint | symbol): undefined
function observe(source: typeof globalThis): undefined
function observe<T extends Function>(source: T): MloRef<T>
function observe<T extends object>(source: T): MloRef<T>
function observe(source: unknown): MloRef | undefined {
  throwIfDisposed('source')
  return ref(source as object)
}

function unobserve<T extends object>(source: T): MloRef<T> | undefined {
  if (state.disposed) return

  const ref = ObjectSources.get(source) as MloRef<T> | undefined

  if (ref) return ref.dispose()

  console.warn(`Attempting to unobserve an unobserved object:`, source)

  return void 0
}

function flush() {
  if (state.disposed) return 0

  let cleaned = 0

  for (const ref of new Set(ObjectRefs.values())) {
    if ((ref.flush(), ref.collected)) cleaned++
  }

  return cleaned
}

function takeRecords(predicate: (ref: MloRef) => unknown = noop) {
  const records: MloRef[] = []

  if (state.disposed) return records

  for (const ref of values(predicate)) {
    records.push(ref)

    ObjectRegistry.unregister(ref)
    ObjectRefs.delete(ref.id)

    const source = ref.deref()!
    if (source) ObjectSources.delete(source)
  }

  return records
}

function* values(predicate: (ref: MloRef) => unknown = noop) {
  if (state.disposed) return

  for (const ref of new Set(ObjectRefs.values())) {
    ref.flush()

    if (ref.collected) continue

    const flag = predicate(ref)

    if (flag === true) continue
    if (flag === false) break

    yield ref
  }
}

function toString(): string {
  return `[object MLO]`
}

function toJSON(): MloData {
  const items: MloObject[] = []
  const stats: MloStats = {}

  for (const ref of mlo.values()) {
    const source = ref.deref()
    if (!source) continue

    items.push(ref.toJSON())

    if (ref.type === 'element') {
      stats.elements.total++

      if (ref.detached) {
        stats.elements.detached++
      }

      continue
    }

    if (ref.type === 'component') {
      stats.components.total++

      if (ref.detached) {
        stats.components.detached++
      }
      continue
    }

    const item = getStatsItem(ref.category)
    item.total++

    if (ref.detached) {
      item.detached++
    }
  }

  return { timestamp: Date.now(), items, stats }

  function getStatsItem(category: string) {
    let item = stats[category]

    if (!item) {
      item = { total: 0, detached: 0, details: [] }
      stats[category] = item
    }

    return item
  }
}

function dispose() {
  if (state.disposed) return

  disposeAll(subscriptions)
  subscriptions.length = 0

  state.disposed = true
}

function throwIfDisposed(method: string) {
  if (state.disposed) {
    throw new Error(`Cannot call mlo.${method}() on a disposed instance.`)
  }
}
