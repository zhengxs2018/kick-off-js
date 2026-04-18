import type { MloRef } from '../../types/ref.js'

/**
 * 对象来源
 *
 * @internal
 * @deprecated 内部API，请勿在外部使用
 */
export const ObjectSources = new WeakMap<object, MloRef<object>>()

/**
 * 对象引用
 *
 * @internal
 * @deprecated 内部API，请勿在外部使用
 */
export const ObjectRefs = new Map<number, MloRef<object>>()

/**
 * 对象引用关系
 *
 * @internal
 * @deprecated 内部API，请勿在外部使用
 */
export const ObjectLinks = new WeakMap<MloRef, Set<number>>()

/**
 * 对象注册表
 *
 * @internal
 * @deprecated 内部API，请勿在外部使用
 */
export const ObjectRegistry = new FinalizationRegistry<number>((id) => {
  const ref = ObjectRefs.get(id)
  if (ref && !ref.disposed) ref.dispose()
})
