/**
 * 编译期抽取的依赖清单：供消费方在边界校验远程规则（外部用 zod），包内零消费
 *
 * - 三个字段均为规则中**实际引用**的名字集合，未引用即不出现（非全量注册表快照）
 * - 此模块是 `Manifest` 的唯一真相源，消费方一律 `import type`，禁止内联同形状
 */
export interface Manifest {
  /** 规则中实际引用的过滤器名集合 */
  filters: string[];
  /** 规则中实际引用的修饰符名集合 */
  modifiers: string[];
  /** 规则中实际引用的过程名集合（含内置 text/node/html/attr） */
  procedures: string[];
}
