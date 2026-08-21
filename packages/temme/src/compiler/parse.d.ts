/**
 * parse 解析产物的固定类型声明（手写维护）
 *
 * - `build.ts` 只生成同目录 `parse.js`（peggy parser 运行时代码），不覆盖本文件
 * - `parse` 把纯字符串规则文本解析为 `TemmeSelector[]`，直接可喂给 `compile`
 */
import type { TemmeSelector } from './ast.js';

/** peggy 允许的起始规则名 */
export type StartRules = 'Start';

/** peggy 语法错误的运行时类型：解析失败时抛出 */
export declare class SyntaxError extends Error {
  readonly expected: unknown;
  readonly found: unknown;
  readonly location: {
    start: { offset: number; line: number; column: number };
    end: { offset: number; line: number; column: number };
  };
  constructor(
    message: string,
    expected: unknown,
    found: unknown,
    location: SyntaxError['location'],
  );
  name: 'SyntaxError';
}

/**
 * 把纯字符串规则文本解析为 `TemmeSelector[]`
 *
 * @param input - 规则文本，如 `div .name $name`
 * @param options - peggy 解析选项（如 `startRule`）；缺省从 `Start` 规则开始
 * @returns 选择器 AST 数组
 */
export declare function parse(
  input: string,
  options?: {
    startRule?: StartRules;
    [key: string]: unknown;
  },
): TemmeSelector[];
