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
  | 'unknown';

/**
 * 对象类型
 */
export type MloObjectType = 'Function' | 'Object' | 'Array' | 'Component' | 'Element' | 'Unknown';

export interface MloFrameworkInfo {
  name: string;
  version: string;
  majorVersion: number;
}

export interface MloObjectStack {
  id?: number;
  type: string;
  stack: string | undefined;
  at: number;
}

export interface MloObjectMeta {
  /**
   * 框架信息
   */
  framework?: MloFrameworkInfo;

  [key: PropertyKey]: any;
}

/**
 * 对象引用接口
 */
export interface MloObject {
  /**
   * ID
   */
  readonly id: number;

  /**
   * 名称
   */
  name: string;

  /**
   * 类型
   */
  type: (string & {}) | MloObjectType;

  /**
   * 分类
   */
  category: (string & {}) | MloObjectCategory;

  /**
   * 元信息，包含对象的原型链等信息，供用户参考
   */
  readonly meta: MloObjectMeta;

  /**
   * 标签列表
   *
   * 允许用户为对象添加任意标签，以便更好地组织和管理对象
   * 标签可以是任何字符串，用户可以根据需要定义和使用标签
   * 例如，可以使用标签来标记对象的用途、所属模块、生命周期阶段等
   */
  readonly labels: string[];

  /**
   * 与该对象相关的链接列表，描述了该对象与其他对象之间的关系。
   */
  readonly links: number[];

  /**
   * 对象的堆栈信息列表
   */
  readonly stacks: MloObjectStack[];

  /**
   * 是否正在被观察
   */
  readonly observed: boolean;

  /**
   * 是否已被垃圾回收机制回收
   */
  readonly disposed: boolean;

  /**
   * 是否游离
   */
  readonly detached: boolean;

  /**
   * 创建时间戳
   */
  readonly createdAt: number;

  /**
   * 是否已被垃圾回收机制标记为可回收
   */
  readonly collected: boolean;

  /**
   * 回收时间戳
   */
  readonly collectedAt?: number | null;
}
