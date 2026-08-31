import { WS_REGEX, DEFAULT_CAPTURE_KEY } from '../common/constants.js';
import type { WhitespaceMode } from '../common/types.js';
import type { LinkedCapture } from './linked.js';

/** 捕获状态：用户可见捕获键 → 值（或累积数组）；裸 `$` 归一为 `DEFAULT_CAPTURE_KEY` */
export interface CaptureState {
  captures: Map<string | symbol, unknown>;
}

/**
 * 创建空捕获状态
 *
 * @returns 仅含空字典的初始捕获状态
 */
export function createCaptureState(): CaptureState {
  return { captures: new Map() };
}

export function condenseWhitespace(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  return value.replace(WS_REGEX, ' ').trim();
}

/**
 * 纯函数累积器：写入捕获值，`append` 走数组累积、否则 First-Wins
 *
 * - 语义为「取或建（First-Wins / 数组累积）」，用 `Map.getOrInsertComputed` 原子惰性初始化
 *
 * @param state - 目标捕获状态
 * @param key - 捕获键名
 * @param value - 待写入值；undefined / null 直接跳过
 * @param append - 是否走数组累积语义
 */
export function accumulate(
  state: CaptureState,
  key: string | symbol,
  value: unknown,
  append: boolean,
): void {
  if (value === undefined || value === null) {
    return;
  }
  if (!append) {
    state.captures.getOrInsertComputed(key, () => value);
    return;
  }
  const existing = state.captures.get(key);
  const bucket = Array.isArray(existing) ? existing : existing !== undefined ? [existing] : [];
  if (!Array.isArray(existing)) {
    state.captures.set(key, bucket);
  }
  if (Array.isArray(value)) {
    for (const v of value) {
      bucket.push(v);
    }
    return;
  }
  bucket.push(value);
}

/**
 * 写入已 Link 的捕获：闭包已在 Link 阶段绑定，此处只按结构化布尔短路并写状态
 *
 * - `boundFilterChain` 用 `== null` 判空：Link 对未注册过滤器降级为 undefined，与显式 null 同义
 *
 * @param state - 目标捕获状态
 * @param capture - 已 Link 的捕获定义
 * @param rawValue - 从适配器抽取的原始值
 * @param whitespace - 空白处理模式
 */
export function applyLinkedCapture(
  state: CaptureState,
  capture: LinkedCapture,
  rawValue: unknown,
  whitespace: WhitespaceMode = 'preserve',
): void {
  const preprocessed = whitespace === 'condense' ? condenseWhitespace(rawValue) : rawValue;
  const converted = capture.boundTypeConvert(preprocessed);
  const chain = capture.boundFilterChain;
  const value = chain == null ? converted : chain(converted);
  if (value === undefined) {
    return;
  }

  const { boundModifier } = capture;
  if (boundModifier === undefined) {
    accumulate(state, capture.name, value, capture.append);
    return;
  }

  boundModifier(state, capture.name, value);
}

/**
 * 投影内部状态为用户结果对象
 *
 * @param state - 源捕获状态
 * @param shape - 列表输出形状：默认 `'columns'` 返回列式对象；`'rows'` 将列式对象
 *                按文档序对齐为对象数组（drive 已按文档正序累积）
 * @returns 用户可见的捕获结果对象
 */
export function toResult(state: CaptureState, shape: 'columns' | 'rows' = 'columns'): unknown {
  const columns = toColumns(state);
  if (shape === 'rows') {
    return toRows(columns);
  }
  return columns;
}

function toColumns(state: CaptureState): Record<string, unknown> {
  const defaultValue = state.captures.get(DEFAULT_CAPTURE_KEY);
  if (defaultValue !== undefined) {
    return defaultValue as Record<string, unknown>;
  }
  const out: Record<string, unknown> = {};
  for (const [key, value] of state.captures) {
    if (typeof key === 'string') {
      out[key] = value;
    }
  }
  return out;
}

/**
 * 将列表模式的列式对象（各字段独立数组，drive 已按文档正序累积）转成行数组。
 *
 * @param columns - `toColumns` 产出的列式对象
 * @returns 按 DOM 顺序对齐的对象数组，缺失项补 `undefined`
 */
function toRows(columns: Record<string, unknown>): Array<Record<string, unknown>> {
  const keys = Object.keys(columns);
  const arrays = keys.map(k => {
    const v = columns[k];
    return Array.isArray(v) ? v : [v];
  });
  const len = arrays.reduce((max, arr) => Math.max(max, arr.length), 0);
  const rows: Array<Record<string, unknown>> = [];
  for (let i = 0; i < len; i++) {
    const row: Record<string, unknown> = {};
    for (let k = 0; k < keys.length; k++) {
      row[keys[k]!] = arrays[k]![i];
    }
    rows.push(row);
  }
  return rows;
}
