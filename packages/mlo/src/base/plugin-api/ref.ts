import { isElement, isObservable } from '../common/utils.js'
import { inBrowser } from '../common/env.js'
import { readonly, writable, constant, getter } from '../common/descriptors.js'
import type { MloRef } from '../../types/ref.js'
import type { MloObject } from '../../types/object.js'
import { emit } from './event.js'
import {
  ObjectSources,
  ObjectRefs,
  ObjectLinks,
  ObjectRegistry,
} from './store.js'

/**
 * 对象引用索引计数器
 *
 * @internal
 * @deprecated 内部API，请勿在外部使用
 */
let idxCounter = 0

/**
 * 是否对象引用
 *
 * @internal
 * @deprecated 内部API，请勿在外部使用
 */
const RefSymbolKey = Symbol('MloRef')

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

  const target = new WeakRef(source)

  const state = {
    observed: true,
    collected: false,
    disposed: false,
  }

  const self: MloRef<T> = Object.create(null, {
    ...ResolveObjectInfo(source),
    id: readonly(id),
    observed: getter(() => state.observed),
    detached: getter(checkAlive),
    collected: getter(() => state.collected),
    disposed: getter(() => state.disposed),
    labels: readonly(new Set()),
    links: getter(() => ObjectLinks.get(self) || new Set()),
    linkTo: constant((target: MloRef): MloRef<T> => {
      if (state.disposed || target === self) return self

      if (isRef(self)) {
        LinkTo(self, target)
        LinkTo(target, self)
      } else {
        console.trace(`Attempting to link an Non-ref object:`, target)
      }

      return self
    }),
    unlink: constant((target: MloRef): MloRef<T> => {
      if (state.disposed || target === self) return self

      if (isRef(target)) {
        Unlink(self, target)
        Unlink(target, self)
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
  if (emit('object:observe', { detail: self }) === false) {
    return self
  }

  ObjectRefs.set(id, self)
  ObjectSources.set(source, self)
  ObjectRegistry.register(source, id, self)
  state.observed = true

  emit('object:observed', { detail: self })

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
      detached: self.detached,
    }
  }

  function dispose(): MloRef<T> {
    if (state.disposed) {
      console.warn(`Attempting to disconnect an already disposed ref:`, self)
      return self
    }

    state.observed = false
    state.disposed = true

    ObjectRegistry.unregister(self)

    ObjectRefs.delete(id)
    ObjectLinks.delete(self)

    const source = target.deref()

    if (source) {
      ObjectSources.delete(source)
      emit('object:unobserved', { detail: self })
    } else {
      state.collected = true
      emit('object:collected', { detail: self })
    }

    return self
  }

  function checkAlive() {
    const source = target.deref()
    return isElement(source) ? source.isConnected : false
  }
}

/**
 * 解析对象信息
 *
 * @internal
 * @deprecated 内部API，请勿在外部使用
 * @param source - 源对象
 * @returns 包含对象名称、类型和类别的对象信息
 */
function ResolveObjectInfo(source: object) {
  if (Array.isArray(source)) {
    return {
      name: writable('unknown'),
      type: writable('Array'),
      category: writable('object'),
    }
  }

  if (source instanceof Function) {
    return {
      name: writable((source as Function).name || 'anonymous'),
      type: writable('Function'),
      category: writable('function'),
    }
  }

  if (inBrowser && source instanceof Element) {
    return {
      name: writable(source.tagName.toLowerCase()),
      type: writable(source.constructor.name),
      category: writable('element'),
    }
  }

  const { constructor } = source

  return {
    name: writable('unknown'),
    type: writable(
      // 使用 Object.create() 创建的对象没有 constructor
      constructor ? constructor.name : 'Object'
    ),
    category: writable('object'),
  }
}

/**
 * 建立链接
 *
 * @internal
 * @deprecated 内部API，请勿在外部使用
 * @param source - 源对象引用
 * @param target - 目标对象引用
 */
function LinkTo(source: MloRef, target: MloRef) {
  const links = GetOrCreateLinks(source, true)
  if (links) links.add(target.id)
}

/**
 * 解除链接
 *
 *
 * @internal
 * @deprecated 内部API，请勿在外部使用
 * @param source - 源对象引用
 * @param target - 目标对象引用
 */
function Unlink(source: MloRef, target: MloRef) {
  const links = GetOrCreateLinks(source)

  if (links && links.delete(target.id) && links.size === 0) {
    ObjectLinks.delete(source)
  }
}

/**
 * 获取或创建链接集合
 *
 * @internal
 * @deprecated 内部API，请勿在外部使用
 * @param ref - 对象引用
 * @param Create - 是否创建链接集合（如果不存在）
 * @returns 链接集合或 undefined
 */
function GetOrCreateLinks(ref: MloRef): Set<number> | undefined
function GetOrCreateLinks(ref: MloRef, Create: true): Set<number>
function GetOrCreateLinks(
  ref: MloRef,
  Create?: boolean
): Set<number> | undefined {
  const links = ObjectLinks.get(ref)

  if (links) return links

  if (!Create) return undefined

  const newLinks = new Set<number>()

  ObjectLinks.set(ref, newLinks)

  return newLinks
}
