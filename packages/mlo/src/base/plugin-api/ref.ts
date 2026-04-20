import { analyzePrototype, isObservable } from '../common/utils.js'
import { inBrowser } from '../common/env.js'
import { readonly, writable, constant, getter } from '../common/descriptors.js'
import type { MloRef } from '../../types/ref.js'
import type { MloObject } from '../../types/object.js'
import { emit } from './event.js'
import { ObjectSources, ObjectRefs } from './store.js'
import { track, untrack } from './tracker.js'
import {
  MLO_OBJECT_BEFORE_OBSERVE_EVENT,
  MLO_OBJECT_COLLECTED_EVENT,
  MLO_OBJECT_DISPOSED_EVENT,
  MLO_OBJECT_OBSERVED_EVENT,
} from './consts.js'

/**
 * 是否对象引用
 *
 * @internal
 * @deprecated 内部API，请勿在外部使用
 */
const RefSymbolKey = Symbol('MloRef')

/**
 * 对象引用索引计数器
 *
 * @internal
 * @deprecated 内部API，请勿在外部使用
 */
let idxCounter = 0

/**
 * 判断是否为对象引用
 *
 * @param value - 待判断的值
 * @returns 如果值是对象引用，则返回 true；否则返回 false
 */
export function isRef(value: any): value is MloRef {
  return !!(value && value[RefSymbolKey] === true)
}

/**
 * 创建对象引用
 *
 * @internal
 * @deprecated 仅供插件开发者使用，普通用户请勿使用
 * @param source - 源对象
 * @returns 对象引用或 undefined
 */
export function ref(source: null | undefined): undefined
export function ref(
  source: string | number | boolean | bigint | symbol
): undefined
export function ref(source: typeof globalThis): undefined
export function ref<T extends Function>(source: T): MloRef<T>
export function ref<T extends object>(source: T): MloRef<T>
export function ref(source: unknown): MloRef | undefined {
  if (isObservable(source) === false) return undefined
  return (
    (ObjectSources.get(source) as MloRef | undefined) ||
    CreateRef(source as object)
  )
}

/**
 * 解除对象引用
 *
 * @internal
 * @deprecated 仅供插件开发者使用，普通用户请勿使用
 * @param ref - 对象引用
 * @returns 解除引用后的对象引用或 undefined
 */
export function unref<T extends object>(ref: MloRef<T>): MloRef<T> | undefined {
  if (isRef(ref) && !ref.disposed) return ref.dispose()
  console.trace(`Attempting to unref an Non-ref object:`, ref)
  return void 0
}

/**
 * 创建对象引用
 *
 * @internal
 * @deprecated 内部API，请勿在外部使用
 * @param source - 源对象引用
 * @returns 对象引用或 null
 */
function CreateRef<T extends object>(source: T): MloRef<T> | undefined {
  const id = idxCounter++

  const state = {
    observed: true,
    collected: false,
    collectedAt: null as number | null,
    disposed: false,
  }

  const target = new WeakRef(source)

  const self: MloRef<T> = Object.create(null, {
    ...ResolveObjectInfo(source, target),
    id: readonly(id),
    labels: constant(new Set()),
    links: constant(new Set()),
    stacks: constant([]),
    observed: getter(() => state.observed),
    collected: getter(() => state.collected),
    collectedAt: getter(() => state.collectedAt),
    createdAt: readonly(Date.now()),
    disposed: getter(() => state.disposed),
    linkTo: constant(function link(target: MloRef): MloRef<T> {
      if (self.disposed || target === self) return self

      if (isRef(self)) {
        self.links.add(target.id)
        target.links.add(self.id)
      } else {
        console.trace(`Attempting to link an Non-ref object:`, target)
      }

      return self
    }),
    unlink: constant(function unlink(target: MloRef): MloRef<T> {
      if (self.disposed || target === self) return self

      if (isRef(target)) {
        self.links.delete(target.id)
        target.links.delete(self.id)
      } else {
        console.trace(`Attempting to unlink an Non-ref object:`, target)
      }

      return self
    }),
    deref: constant((): T | undefined => {
      if (state.disposed) return undefined

      const source = target.deref()
      return source ? source : void dispose()
    }),
    flush: constant((): undefined => {
      if (state.disposed) return undefined

      const source = target.deref()
      return source ? undefined : void dispose()
    }),
    toString: constant(toString),
    toJSON: constant(toJSON),
    dispose: constant(dispose),
    [RefSymbolKey]: constant(true),
    [Symbol.toStringTag]: constant('MloRef'),
    [Symbol.toPrimitive]: constant(toString),
    [Symbol.dispose]: constant(dispose),
  })

  // Note: 允许外部在观察前取消观察，以避免不必要的性能开销
  if (emit(MLO_OBJECT_BEFORE_OBSERVE_EVENT, { detail: self }) === false) {
    return self
  }

  track(source, self)

  ObjectRefs.set(id, self)
  ObjectSources.set(source, self)

  state.observed = true

  emit(MLO_OBJECT_OBSERVED_EVENT, { detail: self })

  return self

  function toString(): string {
    return `${self.type}#${self.name}<${self.id}>`
  }

  function toJSON(): MloObject {
    return {
      id: self.id,
      name: self.name,
      type: self.type,
      category: self.category,
      labels: Array.from(self.labels),
      links: Array.from(self.links),
      stacks: self.stacks,
      meta: self.meta,
      observed: self.observed,
      detached: self.detached,
      disposed: self.disposed,
      createdAt: self.createdAt,
      collected: self.collected,
      collectedAt: self.collectedAt,
    }
  }

  function dispose(): MloRef<T> {
    if (state.disposed) {
      console.debug(`Attempting to disconnect an already disposed ref:`, self)
      return self
    }

    untrack(self)

    ObjectRefs.delete(id)

    const source = target.deref()

    state.observed = false
    state.disposed = true

    if (source) {
      ObjectSources.delete(source)
      emit(MLO_OBJECT_DISPOSED_EVENT, { detail: self })
    } else {
      state.collected = true
      state.collectedAt = Date.now()
      emit(MLO_OBJECT_COLLECTED_EVENT, { detail: self })
    }

    return self
  }
}

/**
 * 解析对象信息
 *
 * @internal
 * @deprecated 内部API，请勿在外部使用
 * @param source - 源对象
 * @param ref - 对象的弱引用
 * @returns 包含对象名称、类型和类别的对象信息
 */
function ResolveObjectInfo(source: object, ref: WeakRef<object>) {
  if (Array.isArray(source)) {
    return {
      name: writable('unknown'),
      type: writable('Array'),
      category: writable('object'),
      meta: readonly({
        className: 'Array',
        extends: [],
      }),
      detached: writable(false),
    }
  }
  if (typeof source === 'function') {
    return {
      name: writable((source as Function).name || 'anonymous'),
      type: writable('Function'),
      category: writable('function'),
      meta: readonly({
        className: 'Function',
        extends: [],
      }),
      detached: writable(false),
    }
  }

  if (inBrowser && source instanceof Element) {
    return {
      name: writable(source.tagName.toLowerCase()),
      type: writable(source.constructor.name),
      category: writable('element'),
      meta: readonly({
        className: source.constructor.name,
        extends: ['Element'],
      }),
      detached: writable(() => (ref.deref() as Element)?.isConnected ?? false),
    }
  }

  const [className, prototype] = analyzePrototype(source)

  return {
    name: writable('unknown'),
    type: writable(className),
    category: writable('object'),
    meta: readonly({ className, extends: prototype }),
    detached: writable(false),
  }
}
