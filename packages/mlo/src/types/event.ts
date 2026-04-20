import type { MloRef } from './ref.js'

export type DisposeLike = {
  dispose(): void
}

export interface Emitter<Events extends object = object> extends DisposeLike {
  on<T extends keyof Events>(
    type: T,
    listener: MloEventListener<Events[T]>
  ): DisposeLike
  on<T>(type: PropertyKey, listener: MloEventListener<T>): DisposeLike
  on(type: PropertyKey, listener: MloEventListener): DisposeLike

  off(type: PropertyKey, listener: MloEventListener): void

  emit(type: PropertyKey, data: unknown): boolean
}

/**
 * 事件对象
 */
export type MloEvent = CustomEvent<MloRef>

/**
 * 事件监听器
 */
export type MloEventListener<T = any> = (event: T) => unknown
