/**
 * 判定给定值是否为非空对象（不含数组、不含 null）。
 *
 * @returns 是普通对象则 true，否则 false
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
