/**
 * 运行时环境变量（Env）契约 —— 归 dev-runtime 定义
 *
 * - dev-impl-src 在 linked.ts 仅声明了 `ModifierFunction` / `ProcedureFunction` / `WhitespaceMode`，
 *   未落 `Env` 与 primitive convert；此处补齐，link.ts 与 drive.ts 共用
 * - `Env` 是 filter / modifier / procedure 注册表 + 空白策略的唯一真相源；
 *   drive 单独接收 engine，故 Env 不承载 engine
 * - 全部为只读 Map，link 阶段一次性解析闭包，运行期零字典查询
 */
import type { SerializableLiteral, WhitespaceMode } from '../common/types.js';
import { DEFAULT_WHITESPACE } from '../common/constants.js';

import type { CaptureState } from './state.js';
import type { ProcedureFunction } from './linked.js';

export function createEnv(init?: EnvInit): Env {
  const {
    filters = {},
    modifiers = {},
    procedures = {},
    whitespace = DEFAULT_WHITESPACE,
  } = init || {};

  return {
    filters: new Map(Object.entries(filters)),
    modifiers: new Map(Object.entries(modifiers)),
    procedures: new Map(Object.entries(procedures)),
    whitespace,
  };
}

/** 未绑定参数的过滤器：运行时按 (input, ...args) 调用 */
export type FilterFunction = (input: unknown, ...args: SerializableLiteral[]) => unknown;

/** 未绑定参数的修饰器：运行时按 (state, key, value, ...args) 调用 */
export type ModifierHandler = (
  state: CaptureState,
  key: string | symbol,
  value: unknown,
  ...args: SerializableLiteral[]
) => void;

/** 未绑定参数的用户过程：运行时按 (input, ...args) 调用 */
export type ProcedureHandler = ProcedureFunction;

export interface Env {
  readonly filters: ReadonlyMap<string, FilterFunction>;
  readonly modifiers: ReadonlyMap<string, ModifierHandler>;
  readonly procedures: ReadonlyMap<string, ProcedureHandler>;
  readonly whitespace: WhitespaceMode;
}

export interface EnvInit {
  filters?: Record<string, FilterFunction>;
  modifiers?: Record<string, ModifierHandler>;
  procedures?: Record<string, ProcedureHandler>;
  whitespace?: WhitespaceMode;
}
