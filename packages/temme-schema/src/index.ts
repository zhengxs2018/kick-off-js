import { z } from 'zod';

/**
 * 边界校验 Schema（可选出口，经 `temme/schema` 子路径）
 *
 * - 仅消费方在加载远程规则/外部 JSON 时调用；包内运行链路零校验，信任输入
 * - 不 re-export 进顶层 `index`：与 compiler 内部类型同名但语义为校验态，隔离避免混淆
 * - `@regex` 字面量走 `SerializableLiteralSchema` 的 `{$regex}` 分支，覆盖序列化往返风险点（H1'）
 */

/** 类型注解标识列表或 null */
export const TypeAnnotationSchema = z.array(z.string()).nullable();

/** 已降维字面量：JSON 可承载的全部形态 + 正则字典 */
export const SerializableLiteralSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.object({ $regex: z.literal(true), source: z.string(), flags: z.string() }),
  ]),
);

/** 字段直取目标形态（按 `kind` 判别的四种原生查找） */
const NativeLookupSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('class'), className: z.string() }),
  z.object({ kind: z.literal('id'), id: z.string() }),
  z.object({ kind: z.literal('tag'), tagName: z.string() }),
  z.object({ kind: z.literal('attr'), name: z.string(), value: z.string() }),
]);

/** 编译期字段直取指令（四种目标形态） */
export const FieldLookupSchema = z.discriminatedUnion('relation', [
  z.object({ relation: z.literal('self') }),
  z.object({
    relation: z.literal('child'),
    strategy: NativeLookupSchema,
    anchor: z.any().optional(),
  }),
  z.object({
    relation: z.literal('parent'),
    strategy: NativeLookupSchema,
    steps: z.number().int().nonnegative(),
    anchor: z.any().optional(),
  }),
  z.object({ relation: z.literal('fallback'), css: z.string() }),
]);

/** 计划侧过滤器 */
export const PlanFilterSchema = z.object({
  isArrayFilter: z.boolean(),
  name: z.string(),
  args: z.array(SerializableLiteralSchema),
});

/** 计划侧修饰符 */
export const PlanModifierSchema = z.object({
  name: z.string(),
  args: z.array(SerializableLiteralSchema),
});

/** 计划侧捕获 */
export const PlanCaptureSchema = z.object({
  name: z.string(),
  typeAnnotation: TypeAnnotationSchema,
  filterList: z.array(PlanFilterSchema).nullable(),
  modifier: z.array(PlanModifierSchema).nullable(),
  procedureName: z.string(),
  procedureArgs: z.array(z.union([z.string(), SerializableLiteralSchema])),
  hasTypeModifier: z.boolean(),
  hasFilter: z.boolean(),
  hasModifier: z.boolean(),
  hasNonBuiltinProcedure: z.boolean(),
  append: z.boolean(),
});

/** 计划侧节点 */
export const PlanNodeSchema = z.object({
  parentId: z.number().int().nullable(),
  css: z.string(),
  captures: z.array(PlanCaptureSchema),
  children: z.array(z.number().int()),
  assignValue: SerializableLiteralSchema.optional(),
  fieldLookup: FieldLookupSchema.optional(),
});

/** 依赖清单 */
export const ManifestSchema = z.object({
  filters: z.array(z.string()),
  modifiers: z.array(z.string()),
  procedures: z.array(z.string()),
});

/** 纯 POJO 执行计划（含可选 manifest） */
export const ExecutionPlanSchema = z.object({
  roots: z.array(z.number().int()),
  nodes: z.array(PlanNodeSchema),
  manifest: ManifestSchema.optional(),
});

/**
 * 在边界校验外部执行计划结构
 *
 * - 消费方加载远程规则时调用；非法输入抛 `ZodError`，由调用方决定如何呈现
 * - 包内运行链路不调用此函数
 *
 * @param plan - 待校验的执行计划（通常来自 `deserialize`）
 * @returns 校验通过的执行计划
 */
export function parseExecutionPlan(plan: unknown): z.infer<typeof ExecutionPlanSchema> {
  return ExecutionPlanSchema.parse(plan);
}
