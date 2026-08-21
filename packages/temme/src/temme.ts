import { parse } from './compiler/parse.js';
import type { ExecutionPlan, TemmeSelector } from './compiler/index.js';
import { createEnv } from './runtime/env.js';
import type { Env, EnvInit } from './runtime/env.js';
import { linkedom } from './parsers/linkedom.js';
import type { TemmeNode, HtmlParser } from './parsers/parser.js';

import { createExtractor } from './extractor.js';

/**
 * 用已解析的 temme 选择器抽取 HTML，返回捕获结果对象
 *
 * @param html - HTML 文本
 * @param selectors - 选择器
 * @param options - 可选环境覆盖 / 自定义引擎
 * @returns 捕获结果（键为捕获名，值为抽取内容）
 */
export function temme<T extends Record<string, unknown>>(
  html: string | TemmeNode<unknown>,
  selectors: string,
): T;
export function temme<T extends Record<string, unknown>>(
  html: string | TemmeNode<unknown>,
  selectors: TemmeSelector[],
): T;

export function temme<T extends Record<string, unknown>>(
  html: string | TemmeNode<unknown>,
  plan: ExecutionPlan,
): T;

export function temme<T extends Record<string, unknown>>(
  html: string | TemmeNode<unknown>,
  selectorsOrPlan: string | TemmeSelector[] | ExecutionPlan,
  options?: TemmeOptions,
): T;

export function temme<T = unknown>(
  html: string | TemmeNode<unknown>,
  selectorsOrPlan: string | TemmeSelector[] | ExecutionPlan,
  options?: TemmeOptions,
): T {
  const { parser = linkedom(), env, ...init } = options || {};

  const extractor = createExtractor({
    env: env || createEnv(init),
    parser,
  });

  const document = typeof html === 'string' ? extractor.load(html) : html;

  // exactOptionalPropertyTypes 下，shape 未定义时不能传 `{ shape: undefined }`，故按有无 shape 分支。
  const options2 = options?.shape === undefined ? undefined : { shape: options.shape };

  if (Array.isArray(selectorsOrPlan)) {
    return extractor.select<Record<string, unknown>>(document, selectorsOrPlan, options2) as T;
  }
  if (typeof selectorsOrPlan === 'string') {
    return extractor.select<Record<string, unknown>>(
      document,
      parse(selectorsOrPlan),
      options2,
    ) as T;
  }
  return extractor.extract<Record<string, unknown>>(document, selectorsOrPlan, options2) as T;
}

export interface TemmeOptions extends EnvInit {
  /**
   * 自定义环境
   */
  env?: Env;

  /**
   * 自定义 DOM 解析器
   *
   * 默认使用 Linkedom
   */
  parser?: HtmlParser<unknown>;

  /**
   * 列表模式输出形状：
   * - `'columns'`（默认）：列式对象 `{ key: value[] }`，保留历史行为
   * - `'rows'`：正序对象数组 `[{ key: value }]`，免去业务侧逆序 zip
   */
  shape?: 'columns' | 'rows';
}
