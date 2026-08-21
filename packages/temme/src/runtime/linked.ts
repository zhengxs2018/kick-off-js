import type { WhitespaceMode, FieldLookup, SerializableLiteral } from '../common/types.js';
import type { CaptureState } from './state.js';

/** 修饰符函数：直接改写捕获状态，而非返回值 */
export type ModifierFunction = (state: CaptureState, key: string | symbol, value: unknown) => void;

/** 过程函数：接收已抽取的输入值，返回处理后的值 */
export type ProcedureFunction = (input: unknown, ...args: unknown[]) => unknown;

/**
 * 链接后的捕获：过滤器 / 修饰符 / 过程已绑定为函数引用闭包
 *
 * - 绑定类字段均为可选：Link 阶段对未注册的扩展点静默降级，运行期按缺省短路，不抛错
 * - 特征字段沿用计划侧的结构化布尔，运行期直接读，杜绝位运算与重复推断
 */
export interface LinkedCapture {
  /** 捕获键名，内部状态键可为 symbol */
  name: string | symbol;
  /** 过程名，内置过程由适配器 `extract` 直接派发 */
  procedureName: string;
  /** 过程参数 */
  procedureArgs: string[];
  /** 类型注解转换器，无注解时为透传 */
  boundTypeConvert: (value: unknown) => unknown;
  /** 是否带类型注解 */
  hasTypeModifier: boolean;
  /** 是否带函数过滤器 */
  hasFilter: boolean;
  /** 是否带状态修饰符 */
  hasModifier: boolean;
  /** 是否使用非内置过程 */
  hasNonBuiltinProcedure: boolean;
  /** 数组捕获：写入走累积语义 */
  append: boolean;
  /** 绑定后的过滤链，未绑定时缺省 */
  boundFilterChain?: ((value: unknown) => unknown) | null;
  /** 绑定后的修饰符链，未绑定时缺省 */
  boundModifier?: ModifierFunction | undefined;
  /** 绑定后的非内置过程，内置过程时缺省 */
  boundProcedure?: ProcedureFunction | undefined;
}

/** 链接后的节点：数组下标即节点 id，交叉引用一律用 id */
export interface LinkedNode {
  /** 节点 id，等于所在数组下标 */
  id: number;
  /** 父节点 id，根节点为 null */
  parentId: number | null;
  /** 匹配该节点的 CSS 选择器 */
  css: string;
  /** 子节点 id 列表 */
  children: number[];
  /** 已绑定闭包的捕获集合 */
  captures: LinkedCapture[];
  /** 赋值语句的静态值，未定义表示需从 DOM 抽取 */
  assignValue?: SerializableLiteral;
  /** 编译期字段直取指令，由 `engine.select` 独家消费 */
  fieldLookup?: FieldLookup;
}

/** 纯执行的链接计划：只含闭包与数据，无字典查表 */
export interface LinkedPlan {
  /** 根节点 id 列表 */
  roots: number[];
  /** 全部链接节点，索引即 id */
  nodes: LinkedNode[];
  /** 空白处理模式 */
  whitespace: WhitespaceMode;
}
