import type { FieldLookup, SerializableLiteral } from '../common/types.js';
import type { Manifest } from './manifest.js';

/** 计划侧过滤器：注册名 + 已降维参数 */
export interface PlanFilter {
  /** true 表示 `||`（对数组每个元素分别过滤），false 表示 `|`（对整个值过滤） */
  isArrayFilter: boolean;
  /** 过滤器注册名 */
  name: string;
  /** 已降维的过滤器参数 */
  args: SerializableLiteral[];
}

/** 计划侧修饰符：注册名 + 已降维参数 */
export interface PlanModifier {
  /** 修饰符注册名 */
  name: string;
  /** 已降维的修饰符参数 */
  args: SerializableLiteral[];
}

/**
 * 计划侧捕获：编译期已固化所有静态标注，运行期只读
 *
 * - 不含任何位掩码字段：位掩码在旧实现中造成过三真相源错位，结构化布尔可直接 JSON 往返
 * - `hasFilter` / `hasModifier` 与 `filterList` / `modifier` 由编译期同步生成，是显式可读的派生字段，
 *   运行时直接读布尔，禁止重新推断或位运算
 */
export interface PlanCapture {
  /** 捕获键名 */
  name: string;
  /** 类型注解（`:number` 等）归约后的类型标识列表，null 表示无 */
  typeAnnotation: string[] | null;
  /** 已降维的函数过滤器列表，null 表示无 */
  filterList: PlanFilter[] | null;
  /** 已降维的状态修饰符列表（顺序应用），null 表示无 */
  modifier: PlanModifier[] | null;
  /** 每个捕获独立声明取值过程；attr 过程经 `procedureArgs[0]` 指定属性名，text/node/html 无参 */
  procedureName: string;
  /** 过程参数（attr 过程的属性名等） */
  procedureArgs: string[];
  /** 是否带类型注解，需走 typeConvert */
  hasTypeModifier: boolean;
  /** 是否带函数过滤器，需走 filterChain */
  hasFilter: boolean;
  /** 是否带状态修饰符，需走 modifier 应用 */
  hasModifier: boolean;
  /** 是否使用非内置过程，需走 boundProcedure */
  hasNonBuiltinProcedure: boolean;
  /** 数组捕获：Write-Append 累积语义（真累积而非 First-Wins） */
  append: boolean;
}

/**
 * 计划侧节点：数组中的物理索引即节点 id（交叉引用键 / V8 连续内存寻址下标）
 *
 * - `parentId` 由编译期透传（根节点为 `null`），禁止运行时重新推断——旧实现曾因此恒为 null 而失去父链
 */
export interface PlanNode {
  /** 父节点 id，根节点为 null */
  parentId: number | null;
  /** 匹配该节点的 CSS 选择器 */
  css: string;
  /** 该节点下的捕获集合 */
  captures: PlanCapture[];
  /** 子节点 id 列表（物理数组索引） */
  children: number[];
  /** 赋值语句的静态值，未定义表示需从 DOM 抽取 */
  assignValue?: SerializableLiteral;
  /** 编译期字段直取指令，未定义表示无原生快路径 */
  fieldLookup?: FieldLookup;
}

/**
 * 纯 POJO 执行计划：`nodes` 为数组、`roots` 为 `number[]`，可直接 `JSON.stringify` / `structuredClone`
 *
 * - 仅含数据、不引用任何函数或注册表，序列化后可直接入库 / 网络传输
 * - 节点 id 即 `nodes` 的数组下标（弃 symbol、弃 Map）
 */
export interface ExecutionPlan {
  /** 根节点 id 列表（物理数组索引） */
  roots: number[];
  /** 全部节点，索引即节点 id */
  nodes: PlanNode[];
  /** 编译期抽取的依赖名集合，供边界校验远程规则；未登记为 undefined */
  manifest?: Manifest;
}
