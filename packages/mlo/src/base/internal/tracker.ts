import type { MloRef } from '../../types/ref.js'
import { ObjectRefs } from './store.js'

/**
 * 对象注册表
 *
 * @internal
 * @deprecated 内部API，请勿在外部使用
 */
const ObjectRegistry = new FinalizationRegistry<number>((id) => {
  const ref = ObjectRefs.get(id)
  if (ref && !ref.disposed) ref.dispose()
})

export function track(object: object, ref: MloRef) {
  ObjectRegistry.register(object, ref.id, ref)
}

export function untrack(ref: MloRef) {
  ObjectRegistry.unregister(ref)
}
