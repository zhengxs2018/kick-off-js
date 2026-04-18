/**
 * 对象分类
 */
export type MloObjectCategory =
  | 'function'
  | 'object'
  | 'element'
  | 'timer'
  | 'observer'
  | 'component'
  | 'unknown'

/**
 * 对象类型
 */
export type MloObjectType =
  | 'Function'
  | 'Object'
  | 'Array'
  | 'Component'
  | 'Unknown'

/**
 * 对象引用接口
 */
export interface MloObject {
  /**
   * ID
   */
  readonly id: number

  /**
   * 名称
   */
  name: string

  /**
   * 类型
   */
  type: (string & {}) | MloObjectType

  /**
   * 分类
   */
  category: (string & {}) | MloObjectCategory

  /**
   * 标签列表
   *
   * 允许用户为对象添加任意标签，以便更好地组织和管理对象
   * 标签可以是任何字符串，用户可以根据需要定义和使用标签
   * 例如，可以使用标签来标记对象的用途、所属模块、生命周期阶段等
   */
  labels: string[]

  /**
   * 与该对象相关的链接列表，描述了该对象与其他对象之间的关系。
   */
  links: number[]

  /**
   * 是否游离
   */
  detached: boolean
}
