/**
 * 链接阶段（Link）：把编译期 ExecutionPlan 绑定为运行期 LinkedPlan
 *
 * 设计边界（与 dev-impl-src 约定）：
 * - LinkedXxx 类型全部 import type 自 linked.ts，本文件不重新声明（反对两份真相源）
 * - LinkedCapture 无 `flags` / `isRoot`：isRoot 由 `append` 布尔直接表达
 * - 绑定产物是闭包：filter / modifier / procedure 的参数在 link 阶段固化，
 *   运行期（state.ts / drive.ts）零字典查询、零位运算
 * - 类型转换（:number 等类型注解）在此绑定为 `boundTypeConvert`（必填，无注解时透传）
 */
import type { ExecutionPlan, PlanCapture } from '../compiler/plan.js';
import type { SerializableLiteral } from '../common/types.js';
import { BUILTIN_ENGINE_PROCEDURES } from '../common/constants.js';
import type { Env, FilterFunction, ModifierHandler } from './env.js';
import type { CaptureState } from './state.js';
import type {
  LinkedCapture,
  LinkedNode,
  LinkedPlan,
  ModifierFunction,
  ProcedureFunction,
} from './linked.js';

/** 类型注解别名：`:number` 等语法糖映射到 primitive 转换器名 */
const TYPE_ANNOTATION_ALIASES: Readonly<Record<string, string>> = {
  number: 'num',
};

/** primitive 转换器：与 temme 的 primitive convert 对齐，仅保留运行期真正用到的子集 */
const PRIMITIVE_CONVERTERS: Readonly<Record<string, (input: unknown) => unknown>> = {
  num: v => (typeof v === 'number' ? v : Number(v)),
  int: v => (typeof v === 'number' ? Math.trunc(v) : parseInt(String(v), 10)),
  bool: v =>
    typeof v === 'boolean' ? v : String(v).length > 0 && String(v).toLowerCase() !== 'false',
  text: v => (typeof v === 'string' ? v : String(v)),
  bigint: v => BigInt(v as string | number | boolean),
};

function bindTypeConvert(capture: PlanCapture): (value: unknown) => unknown {
  if (!capture.hasTypeModifier || capture.typeAnnotation === null) {
    return value => value;
  }
  const fns = capture.typeAnnotation.map(alias => {
    const name = TYPE_ANNOTATION_ALIASES[alias] ?? alias;
    return PRIMITIVE_CONVERTERS[name] ?? ((v: unknown) => v);
  });
  if (fns.length === 1) {
    return fns[0]!;
  }
  return value => {
    let acc = value;
    for (const fn of fns) {
      acc = fn(acc);
    }
    return acc;
  };
}

function bindFilterChain(capture: PlanCapture, env: Env): ((value: unknown) => unknown) | null {
  if (!capture.hasFilter || capture.filterList === null) return null;
  const bound: Array<(value: unknown) => unknown> = [];
  for (const f of capture.filterList) {
    const fn = env.filters.get(f.name) as FilterFunction | undefined;
    if (fn === undefined) continue; // fail-safe：未注册的过滤链节点直接跳过
    const args = f.args as SerializableLiteral[];
    bound.push(value => fn(value, ...args));
  }
  if (bound.length === 0) return null;
  if (bound.length === 1) return bound[0]!;
  return value => {
    let acc = value;
    for (const fn of bound) {
      acc = fn(acc);
    }
    return acc;
  };
}

function bindModifier(capture: PlanCapture, env: Env): ModifierFunction | undefined {
  if (!capture.hasModifier || capture.modifier === null) return undefined;
  const bound: ModifierFunction[] = [];
  for (const m of capture.modifier) {
    const fn = env.modifiers.get(m.name) as ModifierHandler | undefined;
    if (fn === undefined) continue; // fail-safe：未注册的修饰器跳过
    const args = m.args as SerializableLiteral[];
    bound.push((state: CaptureState, key: string | symbol, value: unknown) =>
      fn(state, key, value, ...args),
    );
  }
  if (bound.length === 0) return undefined;
  if (bound.length === 1) return bound[0]!;
  return (state, key, value) => {
    for (const fn of bound) fn(state, key, value);
  };
}

function bindProcedure(capture: PlanCapture, env: Env): ProcedureFunction | undefined {
  // 内置引擎过程（text/html/node/attr）由适配器硬编码，不查字典、不生成闭包
  if (BUILTIN_ENGINE_PROCEDURES.has(capture.procedureName)) return undefined;
  const fn = env.procedures.get(capture.procedureName) as ProcedureFunction | undefined;
  if (fn === undefined) return undefined; // fail-safe：未注册的用户过程跳过
  const args = capture.procedureArgs as SerializableLiteral[];
  return (input, ...extra) => fn(input, ...args, ...extra);
}

function bindCapture(capture: PlanCapture, env: Env): LinkedCapture {
  return {
    name: capture.name,
    procedureName: capture.procedureName,
    procedureArgs: capture.procedureArgs,
    boundTypeConvert: bindTypeConvert(capture),
    hasTypeModifier: capture.hasTypeModifier,
    hasFilter: capture.hasFilter,
    hasModifier: capture.hasModifier,
    hasNonBuiltinProcedure: capture.hasNonBuiltinProcedure,
    append: capture.append,
    boundFilterChain: bindFilterChain(capture, env),
    boundModifier: bindModifier(capture, env),
    boundProcedure: bindProcedure(capture, env),
  };
}

function bindNode(node: ExecutionPlan['nodes'][number], id: number, env: Env): LinkedNode {
  const linked: LinkedNode = {
    id,
    parentId: node.parentId,
    css: node.css,
    children: node.children,
    captures: node.captures.map(c => bindCapture(c, env)),
  };
  if (node.assignValue !== undefined) {
    linked.assignValue = node.assignValue;
  }
  if (node.fieldLookup !== undefined) {
    linked.fieldLookup = node.fieldLookup;
  }
  return linked;
}

/**
 * 把编译期计划绑定为运行期计划
 *
 * @param plan 编译期 ExecutionPlan（compiler/plan.ts）
 * @param env  运行期环境（filter / modifier / procedure 注册表 + 空白策略）
 */
export function link(plan: ExecutionPlan, env: Env): LinkedPlan {
  const nodes: LinkedNode[] = plan.nodes.map((node, id) => bindNode(node, id, env));

  return {
    roots: plan.roots,
    nodes,
    whitespace: env.whitespace,
  };
}
