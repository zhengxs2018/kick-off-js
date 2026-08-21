import type { ExecutionPlan } from './plan.js';

/**
 * 正则字面量字典标记：编译期把 `RegExp` 降维为纯数据，杜绝 `JSON.stringify` 静默丢失
 *
 * - 与 `SerializableLiteral` 的 `{$regex}` 形态一一对应；序列化只写纯数据，反序列化只还原子面
 */
interface RegexLiteral {
  $regex: true;
  source: string;
  flags: string;
}

function isRegexLiteral(value: unknown): value is RegexLiteral {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { $regex?: unknown }).$regex === true &&
    typeof (value as RegexLiteral).source === 'string'
  );
}

/**
 * 将执行计划序列化为 JSON 字符串
 *
 * - 计划中的 `RegExp` 实例降维为 `{$regex}` 字典，避免 `JSON.stringify` 静默丢失；
 *   `deserialize` 经 `JSON.parse` reviver 原子级还原，无需后续树遍历
 * - 不校验结构：远程规则/外部载荷的合法性由消费方用 zod 在边界处理，包内零校验
 *
 * @param plan - 待序列化的执行计划
 * @returns 可存储/传输的 JSON 字符串
 */
export function serialize(plan: ExecutionPlan): string {
  return JSON.stringify(plan, (_key, value) => {
    if (value instanceof RegExp) {
      return { $regex: true, source: value.source, flags: value.flags };
    }
    return value;
  });
}

/**
 * 从 JSON 字符串还原执行计划，并在解析流中原子级还原 `RegExp`
 *
 * - `JSON.parse` 的 reviver 直接把 `{$regex}` 字典重建为 `RegExp` 实例，零额外遍历、零副作用
 * - 不校验字段、不补默认值，信任输入
 *
 * @param json - `serialize` 产出的 JSON 字符串
 * @returns 正则字面量已还原的执行计划
 */
export function deserialize(json: string): ExecutionPlan {
  return JSON.parse(json, (_key, value) => {
    if (isRegexLiteral(value)) {
      return new RegExp(value.source, value.flags);
    }
    return value;
  }) as ExecutionPlan;
}
