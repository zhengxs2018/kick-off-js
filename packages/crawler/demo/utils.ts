import { createHash } from 'node:crypto';

export interface ListEntry {
  name: string;
  url: string;
}

/** urlToId 选项。 */
export interface UrlToIdOptions {
  /**
   * 是否保留查询参数（与 hash 片段）。
   *
   * - `false`（默认）：先 cleanUrl 清理 query/hash，再做 md5——同一页面的不同追踪参数收敛为同一 id。
   * - `true`：不清理，直接对原始 url 做 md5——query 参与去重键（分页/筛选类 URL 需要区分时用）。
   */
  keepQuery?: boolean;
}

/**
 * 清理 URL：去掉查询参数与 hash 片段，并规范化 host 大小写与末尾斜杠。
 *
 * 解析失败（非法 URL）时原样返回，交由调用方 md5 兜底，不抛错中断调度。
 *
 * @param url - 原始 URL
 * @returns 清理后的 URL 字符串
 */
export function cleanUrl(url: string): string {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    return url;
  }

  parsed.search = '';
  parsed.hash = '';

  // 末尾斜杠归一：`/wiki/X/` 与 `/wiki/X` 视为同一页面（根路径 `/` 保留）。
  if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
    parsed.pathname = parsed.pathname.slice(0, -1);
  }

  return parsed.href;
}

/**
 * 由 url 派生队列级去重键：`md5(cleanUrl(url))`。
 *
 * spider 自定义职责：同一 spider 下不同 task 各自去重时，id 需全局唯一。
 * 这里用 md5 定长摘要替代原始 URL，避免中文 URL / 超长 URL 直接做键。
 *
 * @param url - 详情页 URL
 * @param options - 见 {@link UrlToIdOptions}
 * @returns 32 位小写 md5 十六进制字符串
 */
export function urlToId(url: string, options: UrlToIdOptions = {}): string {
  const source = options.keepQuery === true ? url : cleanUrl(url);
  return createHash('md5').update(source).digest('hex');
}

/** cleanHtml 选项。 */
interface CleanHtmlOptions {
  /**
   * 只保留该标记**之后**的片段（按首次出现位置截取，`>` 之后开始）。
   *
   * 找不到该标记时不截取，返回全文——保证解析降级而非直接失空。
   */
  readonly from?: string;

  /** 去除全部标签，只留文本（默认 false，保留标签供后续正则匹配 class/href）。 */
  readonly stripTags?: boolean;
}

/**
 * 统一的 HTML 清理入口：区域截取 + 噪声剥离 + 实体解码 + 空白归一。
 *
 * 合并了原先分散的 `sliceListRegion` / `sliceRegion` / `stripTags` 三个函数，
 * 所有页面清理都走这里，避免多套清理逻辑各自漂移。
 *
 * 处理顺序（顺序敏感，勿调换）：
 * 1. `from` 区域截取——先缩小范围，减少后续正则回溯成本；
 * 2. 剥离 `<script>` / `<style>` / 注释——它们的内容不是正文，且含 `<` `>` 会污染标签正则；
 * 3. 可选去标签（`stripTags`）；
 * 4. HTML 实体解码（含数字实体 `&#123;` / `&#x1F;`）；
 * 5. 空白归一（含 `\u00a0`）并 trim。
 *
 * @param html - 原始 HTML 片段或全文
 * @param options - 见 {@link CleanHtmlOptions}
 * @returns 清理后的 HTML 或纯文本
 */
export function cleanHtml(html: string, options: CleanHtmlOptions = {}): string {
  let text = html;

  // 1. 区域截取：定位到标记后的内容起点；找不到则保留全文（降级不失空）。
  if (options.from) {
    const start = text.indexOf(options.from);
    if (start >= 0) {
      const gt = text.indexOf('>', start);
      text = gt >= 0 ? text.slice(gt + 1) : text.slice(start);
    }
  }

  // 2. 剥离非正文块与注释（先于去标签，避免其内容混入文本）。
  text = text
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');

  // 3. 可选去标签：<br> / </p> / </tr> 等块级边界先换成空格，避免相邻文本粘连。
  if (options.stripTags) {
    text = text
      .replace(/<(?:br|\/p|\/div|\/tr|\/td|\/li|\/h[1-6])[^>]*>/gi, ' ')
      .replace(/<[^>]*>/g, '');
  }

  // 4. 实体解码：命名实体 + 数字实体（十进制/十六进制）。&amp; 放最后，避免二次解码 `&amp;lt;`。
  text = text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    // 数字实体统一处理（含 &#39; 单引号），无需再单列命名规则。
    .replace(/&#(\d+);/g, (_m, code: string) => safeCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, code: string) => safeCodePoint(Number.parseInt(code, 16)))
    .replace(/&amp;/gi, '&');

  // 5. 空白归一（含不换行空格 \u00a0）。
  return text.replace(/[\s\u00a0]+/g, ' ').trim();
}

/** 数字实体转字符；码点非法时返回空串，不抛错中断解析。 */
export function safeCodePoint(code: number): string {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return '';
  try {
    return String.fromCodePoint(code);
  } catch {
    return '';
  }
}
