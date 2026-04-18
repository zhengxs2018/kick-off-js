import type { MloObject} from './object.js'

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
export interface MloRef<T extends object = object> extends Omit<MloObject, 'links' | 'labels'> {
  /**
   * 标签列表
   *
   * 允许用户为对象添加任意标签，以便更好地组织和管理对象
   * 标签可以是任何字符串，用户可以根据需要定义和使用标签
   * 例如，可以使用标签来标记对象的用途、所属模块、生命周期阶段等
   */
  labels: Set<string>

  /**
   * 与该对象相关的链接列表，描述了该对象与其他对象之间的关系。
   */
  links: Set<number>

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
   * 获取原始对象
   */
  deref(): T | undefined

  /**
   * 将当前对象转换为一个可序列化的对象，包含基本信息和链接信息
   */
  toJSON(): MloObject

  /**
   * 返回当前对象的字符串表示，格式为 `${type}#${name}<${id}>`
   */
  toString(): string

  /**
   * 触发一次观察检查，更新当前对象的状态
   */
  flush(): undefined

  /**
   * 断开对当前对象的观察
   */
  dispose(): this

  [Symbol.dispose]: () => void
}
