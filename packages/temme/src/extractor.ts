import { compile } from './compiler/compile.js';
import type { ExecutionPlan, TemmeSelector } from './compiler/index.js';
import { createEnv } from './runtime/env.js';
import type { Env } from './runtime/env.js';
import { link } from './runtime/link.js';
import { drive } from './runtime/drive.js';
import { createEngine } from './runtime/engine.js';
import type { TemmeNode, HtmlParser, HostElement } from './parsers/parser.js';
import type { LinkedPlan } from './runtime/linked.js';

/**
 * 创建 temme 实例
 *
 * @param options
 * @returns
 */
export function createExtractor<Element extends HostElement = unknown>(
  options?: ExtractorOptions<Element>,
): Extractor<Element> {
  const { env = createEnv(), parser } = options || {};

  const engine = createEngine<Element>(parser);

  return {
    load,
    select,
    extract,
    execute,
  };

  function load(html: string): TemmeNode<Element> {
    return engine.parse(html);
  }

  function select<T extends Record<string, unknown>>(
    document: TemmeNode<Element>,
    selectors: TemmeSelector[],
    options?: ExtractOptions,
  ): T {
    return extract(document, compile(selectors), options);
  }

  function extract<T extends Record<string, unknown>>(
    document: TemmeNode<Element>,
    plan: ExecutionPlan,
    options?: ExtractOptions,
  ): T {
    return execute<T>(document, link(plan, env), options);
  }

  function execute<T extends Record<string, unknown>>(
    document: TemmeNode<Element>,
    plan: LinkedPlan,
    options?: ExtractOptions,
  ): T {
    return drive(plan, engine, document, options?.shape) as T;
  }
}

/** 抽取输出选项 */
export interface ExtractOptions {
  /**
   * 列表模式输出形状：
   * - `'columns'`（默认）：列式对象 `{ key: value[] }`，保留 drive 原生累积顺序（文档逆序）
   * - `'rows'`：正序对象数组 `[{ key: value }]`，在结果层逆序对齐，免去业务侧补偿
   */
  shape?: 'columns' | 'rows';
}

export interface ExtractorOptions<Element extends HostElement = unknown> {
  /**
   * 自定义 DOM 解析器
   *
   * 默认使用 Linkedom
   */
  readonly parser?: HtmlParser<Element>;

  /**
   * 自定义环境
   */
  readonly env?: Env;
}

export type Extractor<Element extends HostElement = unknown> = {
  /**
   * 加载 HTML 文档
   *
   * @param html - HTML 文本
   * @returns 文档根节点包装
   */
  load(html: string): TemmeNode<Element>;

  /**
   * 用已解析的 temme 选择器抽取 HTML，返回捕获结果对象
   *
   * @param document - HTML 文档根节点包装
   * @param selectors - 已解析的 temme 选择器 AST（`TemmeSelector[]`）
   * @param options - 抽取输出选项（如列表输出形状）
   * @returns 捕获结果（键为捕获名，值为抽取内容）
   */
  select<T extends Record<string, unknown>>(
    document: TemmeNode<Element>,
    selectors: TemmeSelector[],
    options?: ExtractOptions,
  ): T;

  /**
   * 用已编译的执行计划抽取 HTML，返回捕获结果对象
   *
   * @param document - HTML 文档根节点包装
   * @param plan - 已编译的执行计划（`ExecutionPlan`）
   * @param options - 抽取输出选项（如列表输出形状）
   * @returns 捕获结果（键为捕获名，值为抽取内容）
   */
  extract<T extends Record<string, unknown>>(
    document: TemmeNode<Element>,
    plan: ExecutionPlan,
    options?: ExtractOptions,
  ): T;

  /**
   * 用已链接的执行计划抽取 HTML，返回捕获结果对象
   *
   * @param document - HTML 文档根节点包装
   * @param plan - 已链接的执行计划（`LinkedPlan`）
   * @param options - 抽取输出选项（如列表输出形状）
   * @returns 捕获结果（键为捕获名，值为抽取内容）
   */
  execute<T extends Record<string, unknown>>(
    document: TemmeNode<Element>,
    plan: LinkedPlan,
    options?: ExtractOptions,
  ): T;
};
