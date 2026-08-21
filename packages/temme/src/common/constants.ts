import type { WhitespaceMode } from './types.js';

/**
 * 内置引擎过程单一来源，Compile（特征标注）、Link（绑定分流）、Runtime（extract 派发）三方共用
 *
 * `text` / `html` / `node` / `attr` 由各适配器 `extract` 硬编码，不走 procedures 字典；`find` 等用户过程走字典
 */
export const BUILTIN_ENGINE_PROCEDURES: ReadonlySet<string> = new Set([
  'text',
  'html',
  'node',
  'attr',
]);

/** 未显式声明过程的捕获默认走 `text` 过程 */
export const DEFAULT_PROCEDURE_NAME = 'text';

/**
 * 裸 `$` 捕获归一为此键
 *
 * 与解析边界共享的字符串常量；内部状态另用 symbol 隔离，避免用户键名撞车
 */
export const DEFAULT_CAPTURE_KEY = '@@default-capture@@';

/**
 * 折叠空白：连续空白归一为单空格并去首尾
 *
 * @param value - 待处理的值，非字符串原样返回
 * @returns 折叠后的字符串，或原值
 */
export const WS_REGEX = /\s+/g;

/**
 * 默认空白策略对齐 temme：`condense`（trim + 折叠连续空白）
 * link 阶段固化到 LinkedPlan.whitespace，运行期直接读取
 */
export const DEFAULT_WHITESPACE: WhitespaceMode = 'condense';
