import type { MloObject } from './object.js'

export type MloUnobservableType =
  | string
  | number
  | boolean
  | bigint
  | null
  | undefined
  | symbol
  | typeof globalThis

/**
 * 对象引用接口
 */
export interface MloRef<T extends object = object>
  extends Omit<MloObject, 'links' | 'labels'> {
  readonly labels: Set<string>

  readonly links: Set<number>

  /**
   * 获取原始对象
   */
  deref(): T | undefined

  /**
   * 链接到另一个对象
   *
   * @param target - 另一个对象的引用
   */
  linkTo(target: MloRef): this

  /**
   * 断开与另一个对象的链接
   *
   * @param target - 要断开链接的对象引用
   */
  unlink(target: MloRef): this

  /**
   * 触发一次观察检查，更新当前对象的状态
   */
  flush(): undefined

  /**
   * 断开对当前对象的观察
   */
  dispose(): this

  /**
   * 将当前对象转换为一个可序列化的对象，包含基本信息和链接信息
   */
  toJSON(): MloObject

  /**
   * 返回当前对象的字符串表示，格式为 `${type}#${name}<${id}>`
   */
  toString(): string

  [Symbol.dispose]: () => void
}
