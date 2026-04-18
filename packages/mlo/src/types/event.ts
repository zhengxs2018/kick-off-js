import type { MloRef } from './ref.js'

export type DisposeLike = {
  dispose(): void
}

/**
 * 事件对象
 */
export type MloEvent = CustomEvent<MloRef>

/**
 * 事件监听器
 */
export type MloEventListener<T> = (event: CustomEvent<T>) => void
