/** 空白处理模式：`condense` 折叠连续空白，`preserve` 原样保留 */
export type WhitespaceMode = 'condense' | 'preserve';

/**
 * 可序列化字面量：JSON 边界内唯一允许的字面量形态
 *
 * - RegExp 在编译期降维为 `{ $regex, source, flags }` 纯数据字典，杜绝 `JSON.stringify` 静默丢失
 * - 计划侧与运行时共用此类型，是跨文件唯一真相源（禁止各自内联同形状）
 */
export type SerializableLiteral =
  | string
  | number
  | boolean
  | null
  | { $regex: true; source: string; flags: string };

/** 原生查找指令：编译期字段直取快路径的四种目标形态 */
export type NativeLookup =
  | { kind: 'class'; className: string }
  | { kind: 'id'; id: string }
  | { kind: 'tag'; tagName: string }
  | { kind: 'attr'; name: string; value: string | undefined };

/**
 * 编译期预编译的字段查找指令：把静态已知的 CSS 降级为原生 DOM API 直取
 *
 * - `anchor` 为作用域提升预留：祖先链中的强特征锚点（`#id` / 唯一 class），编译期暂不填充
 * - `fallback` 表示无法降维，运行时退回 `querySelectorAll(css)`
 */
export type FieldLookup =
  | { relation: 'self' }
  | { relation: 'child'; strategy: NativeLookup; anchor?: NativeLookup }
  | { relation: 'parent'; strategy: NativeLookup; steps: number; anchor?: NativeLookup }
  | { relation: 'fallback'; css: string };
