import type { DisposeLike, MloEventListener } from './event.js'
import type { MloExtractPluginOptions, MloPlugin } from './plugin.js'
import type { MloRef } from './ref.js'
import type { MloData } from './snapshot.js'

export type MloInstance = {
  readonly disposed: boolean
  events: {
    onElementAdded: (
      listener: MloEventListener<Element>,
      options?: boolean | AddEventListenerOptions
    ) => DisposeLike
    onElementRemoved: (
      listener: MloEventListener<Element>,
      options?: boolean | AddEventListenerOptions
    ) => DisposeLike
    onObjectObserve: (
      listener: MloEventListener<MloRef>,
      options?: boolean | AddEventListenerOptions
    ) => DisposeLike
    onObjectObserved: (
      listener: MloEventListener<MloRef>,
      options?: boolean | AddEventListenerOptions
    ) => DisposeLike
    onObjectUnobserved: (
      listener: MloEventListener<MloRef>,
      options?: boolean | AddEventListenerOptions
    ) => DisposeLike
    onObjectCollected: (
      listener: MloEventListener<MloRef>,
      options?: boolean | AddEventListenerOptions
    ) => DisposeLike
  }
  use: <P extends MloPlugin<any>>(
    plugin: P,
    options?: MloExtractPluginOptions<P>
  ) => void
  get: <T extends object>(source: T) => MloRef<T> | undefined
  key: <T extends object>(id: number) => MloRef<T> | undefined
  values: (
    predicate?: (ref: MloRef) => unknown
  ) => Generator<MloRef<object>, void, unknown>
  observe: {
    (source: null | undefined): undefined
    (source: string | number | boolean | bigint | symbol): undefined
    (source: typeof globalThis): undefined
    <T extends Function>(source: T): MloRef<T>
    <T extends object>(source: T): MloRef<T>
  }

  unobserve: <T extends object>(source: T) => MloRef<T> | undefined

  flush: () => number

  takeRecords: (
    predicate?: (ref: MloRef<object>) => unknown
  ) => MloRef<object>[]

  dispose: () => void

  toString(): string

  toJSON(): MloData

  [Symbol.dispose]: () => void

  [Symbol.iterator]: (
    predicate?: (ref: MloRef) => unknown
  ) => Generator<MloRef<object>, void, unknown>
}
