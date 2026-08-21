import { BUILTIN_ENGINE_PROCEDURES, DEFAULT_PROCEDURE_NAME } from '../common/constants.js';
import type { FieldLookup, NativeLookup, SerializableLiteral } from '../common/types.js';
import type {
  Capture,
  Filter,
  Literal,
  Procedure,
  Qualifier,
  Section,
  TemmeSelector,
} from './ast.js';
import type { Manifest } from './manifest.js';
import type { ExecutionPlan, PlanCapture, PlanFilter, PlanModifier, PlanNode } from './plan.js';

interface CompilerContext {
  nodes: PlanNode[];
  roots: number[];
  filters: Set<string>;
  modifiers: Set<string>;
  procedures: Set<string>;
}

/**
 * 编译规则 AST 为纯 POJO 执行计划
 *
 * - RegExp 降维为 `{ $regex, source, flags }`，使计划可直接 `JSON.stringify` 而不静默丢值
 * - 捕获的静态特征在此固化为结构化布尔（`hasFilter` 等），运行时只读不再推断
 * - `filter` / `modifier` / `procedure` 定义与 `snippet` 声明不产生节点：其 `code` 为纯文本且永不执行
 * - 包内零校验：非法或未知输入静默跳过，不抛错、不提示
 *
 * @param selectors - 已解析的规则 AST
 * @returns 纯 POJO 执行计划，`nodes` 索引即节点 id
 */
export function compile(selectors: TemmeSelector[]): ExecutionPlan {
  const ctx: CompilerContext = {
    nodes: [],
    roots: [],
    filters: new Set(),
    modifiers: new Set(),
    procedures: new Set(),
  };

  for (const selector of selectors) {
    const nodeId = compileSelector(ctx, selector, null);
    if (nodeId !== null) {
      ctx.roots.push(nodeId);
    }
  }

  return {
    roots: ctx.roots,
    nodes: ctx.nodes,
    manifest: toManifest(ctx),
  };
}

function toManifest(ctx: CompilerContext): Manifest {
  return {
    filters: [...ctx.filters],
    modifiers: [...ctx.modifiers],
    procedures: [...ctx.procedures],
  };
}

function normalizeLiteral(value: Literal): SerializableLiteral {
  if (value instanceof RegExp) {
    return { $regex: true, source: value.source, flags: value.flags };
  }
  return value;
}

function normalizeArgs(args: readonly Literal[] | undefined): SerializableLiteral[] {
  if (args === undefined || args.length === 0) {
    return [];
  }
  return args.map(normalizeLiteral);
}

/**
 * 数组捕获取值过程的参数：剔除嵌套捕获（过程参数只取字面量），其余归约为字符串
 *
 * - `attr(href)` → `['href']`；`node` → `[]`
 * - 嵌套捕获作为过程参数在当前列表语法中无语义，按字面名降级为字符串不影响 attr 取值
 *
 * @param procedure - 取值过程声明
 * @returns 可用于 `createCapture` 的字符参数列表
 */
function procedureArgsOf(procedure: Procedure): string[] {
  return procedure.args.filter(arg => !isCapture(arg)).map(String);
}

function isCapture(item: Literal | Capture | string | null): item is Capture {
  return (
    typeof item === 'object' && item !== null && !(item instanceof RegExp) && 'modifier' in item
  );
}

function isModifierChain(filter: Filter): filter is Extract<Filter, { isModifier: true }> {
  return 'isModifier' in filter;
}

/**
 * 拆分 AST 过滤器链：普通过滤器进 filterList，修饰符链并入 modifier
 *
 * @param ctx - 编译上下文，用于登记 manifest 名字
 * @param filterList - AST 过滤器列表
 * @returns 计划侧过滤器与追加的修饰符名
 */
function splitFilters(
  ctx: CompilerContext,
  filterList: readonly Filter[],
): { filters: PlanFilter[]; modifiers: string[] } {
  const filters: PlanFilter[] = [];
  const modifiers: string[] = [];
  for (const filter of filterList) {
    if (isModifierChain(filter)) {
      for (const name of filter.modifiers) {
        ctx.modifiers.add(name);
        modifiers.push(name);
      }
      continue;
    }
    ctx.filters.add(filter.name);
    filters.push({
      isArrayFilter: filter.isArrayFilter,
      name: filter.name,
      args: normalizeArgs(filter.args),
    });
  }
  return { filters, modifiers };
}

function toPlanModifiers(ctx: CompilerContext, names: readonly string[]): PlanModifier[] {
  return names.map(name => {
    ctx.modifiers.add(name);
    return { name, args: [] };
  });
}

function createCapture(
  ctx: CompilerContext,
  capture: Capture,
  append: boolean,
  procedureName: string,
  procedureArgs: string[],
): PlanCapture {
  const { typeAnnotation } = capture;
  const split = capture.filterList === null ? null : splitFilters(ctx, capture.filterList);
  const modifierNames = [...(capture.modifier ?? []), ...(split?.modifiers ?? [])];
  const filterList = split === null || split.filters.length === 0 ? null : split.filters;
  const modifier = modifierNames.length === 0 ? null : toPlanModifiers(ctx, modifierNames);
  ctx.procedures.add(procedureName);
  return {
    name: capture.name,
    typeAnnotation,
    filterList,
    modifier,
    procedureName,
    procedureArgs,
    hasTypeModifier: typeAnnotation !== null && typeAnnotation.length > 0,
    hasFilter: filterList !== null,
    hasModifier: modifier !== null,
    hasNonBuiltinProcedure: !BUILTIN_ENGINE_PROCEDURES.has(procedureName),
    append,
  };
}

function createNode(ctx: CompilerContext, css: string, parentId: number | null): number {
  ctx.nodes.push({
    parentId,
    css,
    captures: [],
    children: [],
  });
  return ctx.nodes.length - 1;
}

function compileAttributeCaptures(
  ctx: CompilerContext,
  node: PlanNode,
  qualifiers: Qualifier[],
): void {
  for (const qualifier of qualifiers) {
    if (qualifier.type !== 'attribute-qualifier') {
      continue;
    }
    const { value } = qualifier;
    if (!isCapture(value)) {
      continue;
    }
    node.captures.push(createCapture(ctx, value, false, 'attr', [qualifier.attribute]));
  }
}

function compileProcedureCaptures(
  ctx: CompilerContext,
  node: PlanNode,
  procedure: Procedure,
): void {
  const literalArgs = procedure.args.filter(arg => !isCapture(arg)).map(String);
  for (const arg of procedure.args) {
    if (!isCapture(arg)) {
      continue;
    }
    node.captures.push(createCapture(ctx, arg, false, procedure.name, literalArgs));
  }
}

function compileNormalSelector(
  ctx: CompilerContext,
  selector: Extract<TemmeSelector, { type: 'normal-selector' }>,
  parentId: number | null,
): number {
  const sectionCssList = selector.sections.map(sectionToCss);
  const css = sectionCssList.join(' ');
  const index = createNode(ctx, css, parentId);
  const node = ctx.nodes[index]!;
  const lastSection = selector.sections.at(-1);
  if (lastSection !== undefined) {
    compileAttributeCaptures(ctx, node, lastSection.qualifiers);
  }
  if (selector.procedure !== null) {
    compileProcedureCaptures(ctx, node, selector.procedure);
  }
  if (selector.arrayCapture !== null) {
    const procedureName = selector.procedure?.name ?? DEFAULT_PROCEDURE_NAME;
    const procedureArgs = selector.procedure === null ? [] : procedureArgsOf(selector.procedure);
    node.captures.push(
      createCapture(ctx, selector.arrayCapture, true, procedureName, procedureArgs),
    );
  }
  for (const child of selector.children) {
    const childId = compileSelector(ctx, child, index);
    if (childId !== null) {
      node.children.push(childId);
    }
  }
  node.fieldLookup = compileFieldLookup(selector.sections, sectionCssList.at(-1));
  return index;
}

function compileParentRefSelector(
  ctx: CompilerContext,
  selector: Extract<TemmeSelector, { type: 'parent-ref-selector' }>,
  parentId: number | null,
): number {
  const index = createNode(ctx, sectionToCss(selector.section), parentId);
  const node = ctx.nodes[index]!;
  compileAttributeCaptures(ctx, node, selector.section.qualifiers);
  if (selector.procedure !== null) {
    compileProcedureCaptures(ctx, node, selector.procedure);
  }
  node.fieldLookup = { relation: 'self' };
  return index;
}

function compileAssignment(
  ctx: CompilerContext,
  selector: Extract<TemmeSelector, { type: 'assignment' }>,
  parentId: number | null,
): number {
  const index = createNode(ctx, '', parentId);
  const node = ctx.nodes[index]!;
  node.captures.push(createCapture(ctx, selector.capture, false, DEFAULT_PROCEDURE_NAME, []));
  node.assignValue = normalizeLiteral(selector.value);
  node.fieldLookup = { relation: 'self' };
  return index;
}

function compileSelector(
  ctx: CompilerContext,
  selector: TemmeSelector,
  parentId: number | null,
): number | null {
  if (selector.type === 'normal-selector') {
    return compileNormalSelector(ctx, selector, parentId);
  }

  if (selector.type === 'parent-ref-selector') {
    return compileParentRefSelector(ctx, selector, parentId);
  }

  if (selector.type === 'assignment') {
    return compileAssignment(ctx, selector, parentId);
  }

  return null;
}

function sectionToCss({ combinator, element, qualifiers }: Section): string {
  return `${combinator} ${element}${qualifiers.map(qualifierToCss).join('')}`.trim();
}

function qualifierToCss(qualifier: Qualifier): string {
  if (qualifier.type === 'id-qualifier') {
    return `#${qualifier.id}`;
  }
  if (qualifier.type === 'class-qualifier') {
    return `.${qualifier.className}`;
  }
  if (qualifier.type === 'pseudo-qualifier') {
    const { name, content } = qualifier;
    return content === null ? `:${name}` : `:${name}(${content})`;
  }
  const { attribute, operator, value } = qualifier;
  if (operator === null || value === null) {
    return `[${attribute}]`;
  }
  if (isCapture(value)) {
    return `[${attribute}${operator}$${value.name}]`;
  }
  return `[${attribute}${operator}${value}]`;
}

/**
 * 把片段序列降维为字段直取指令
 *
 * - 单片段可直接子代直取；多片段用末段直取 + 上溯 `steps` 还原作用域，避免运行时重跑整条 CSS 路径
 * - 无法降维（伪类、非等值属性匹配）时退回 `fallback` 由适配器 `querySelectorAll` 处理
 *
 * @param sections - 片段序列
 * @returns 字段直取指令
 */
function compileFieldLookup(sections: Section[], lastCss?: string): FieldLookup {
  const last = sections.at(-1);
  if (last === undefined) {
    return { relation: 'self' };
  }
  const strategy = sectionToNativeLookup(last);
  if (strategy === null) {
    return { relation: 'fallback', css: lastCss ?? sectionToCss(last) };
  }
  if (sections.length === 1) {
    return { relation: 'child', strategy };
  }
  return { relation: 'parent', strategy, steps: sections.length - 1 };
}

function sectionToNativeLookup(section: Section): NativeLookup | null {
  const { qualifiers, element } = section;
  if (qualifiers.length === 0) {
    return { kind: 'tag', tagName: element };
  }
  if (qualifiers.length > 1) {
    return null;
  }
  const qualifier = qualifiers[0]!;
  if (qualifier.type === 'id-qualifier') {
    return { kind: 'id', id: qualifier.id };
  }
  if (qualifier.type === 'class-qualifier') {
    return { kind: 'class', className: qualifier.className };
  }
  if (qualifier.type === 'attribute-qualifier') {
    const { attribute, operator, value } = qualifier;
    if (operator !== '=' || value === null || isCapture(value)) {
      return null;
    }
    return { kind: 'attr', name: attribute, value };
  }
  return null;
}
