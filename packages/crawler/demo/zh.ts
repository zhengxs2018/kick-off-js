import { defineSpider, defineTask } from '../src/index.ts';
import { createHttpClient } from '../src/capabilities/http.ts';
import { createJsonlStorage } from '../src/storage/jsonl.ts';

import { cleanHtml, urlToId } from './utils.ts';

const http = createHttpClient({
  baseURL: 'https://wiki.52poke.com',
  maxRetries: 3,
});

interface ListEntry {
  name: string;
  url: string;
}

export const zhSpider = defineSpider({
  name: 'zh',
  concurrency: 3,
  tasks: [
    defineTask('list', async (_, { enqueue }) => {
      const html = await http.get('/wiki/宝可梦列表（按全国图鉴编号）').then(r => r.text());

      const region = cleanHtml(html, { from: '<table' });
      const entries = parseListEntries(region);

      let queued = 0;
      for (const entry of entries) {
        const detailUrl = normalizeDetailUrl(entry.url);
        if (!detailUrl) continue;

        enqueue({
          id: urlToId(detailUrl),
          name: 'detail',
          data: {
            url: detailUrl,
            name: entry.name,
          },
        });
        queued++;
      }

      console.error('[zh.list] entries', entries.length, 'queued', queued);
    }),
    defineTask<{ url: string; name: string }>('detail', async ({ url, name }) => {
      console.error('[detail] fetched status', url);

      const html = await http.get(url, { cache: 'no-store' }).then(r => r.text());

      const raw = parseDetail(html);

      const overview = String(raw.overview ?? '').trim();
      const infoboxText = String(raw.infobox ?? '');
      const gender = parseGenderRatio(infoboxText);

      await using storage = createJsonlStorage('data/detail.jsonl');

      await storage.write({
        id: urlToId(url),
        url,
        name,
        overview,
        heightM: parseHeight(infoboxText),
        weightKg: parseWeight(infoboxText),
        catchRate: parseCatchRate(infoboxText),
        genderMale: gender?.male,
        genderFemale: gender?.female,
        abilities: parseAbilities(infoboxText),
      });
    }),
  ],
});

/**
 * 用原生正则解析列表表格单元格（不依赖第三方选择器）。
 *
 * 真实 52poke 列表页按全国图鉴编号分代，每个宝可梦名字单元格的 class 为 `rdexn-name`，
 * 单元格内是 `<a href="/wiki/XXX" title="XXX">XXX</a>`。
 *
 * 匹配逻辑：
 * - 跨行抓取 class 含 `rdexn-name` 的单元格内容；
 * - 单元格内取第一个 `<a href="/wiki/..." title="...">` 的 href 与 title；
 * - href 解码后含命名空间冒号（如 `神奇宝贝百科:xxx`）跳过；
 * - title 含「列表」或全角括号「（」的（非宝可梦条目）跳过；
 * - 按 url 去重收集 `{ name: title, url: 'https://wiki.52poke.com' + href }`。
 *
 * @param region - <table> 起始的 HTML 片段（可含多个分代表格）
 * @returns 解析出的宝可梦列表条目（name/url 均非空）
 */
function parseListEntries(region: string): Array<ListEntry> {
  // 抓全部含 rdexn-name 的宝可梦名字单元格内容（跨行，忽略大小写），并提取单元格内链接。
  const cells = region.match(/<td[^>]*class="[^"]*rdexn-name[^"]*"[^>]*>(.*?)<\/td>/gis) ?? [];
  const seen = new Set<string>();
  const entries: Array<ListEntry> = [];

  for (const cell of cells) {
    // 单元格内取宝可梦链接的 href 与 title。
    const aMatch = cell.match(/<a\s+href="(\/wiki\/[^"]+)"[^>]*title="([^"]+)"[^>]*>/i);
    if (!aMatch) continue;
    const href = aMatch[1];
    const title = aMatch[2].trim();

    // 解码 href；含命名空间冒号（分类/命名空间页）跳过。
    let decoded: string;
    try {
      decoded = decodeURIComponent(href);
    } catch {
      continue;
    }
    if (decoded.includes(':')) continue;
    // 非宝可梦条目：列表页 / 带全角括号的分类页跳过。
    if (title.includes('列表') || title.includes('（')) continue;

    const url = `https://wiki.52poke.com${href}`;
    if (seen.has(url)) continue;
    seen.add(url);
    entries.push({ name: title, url });
  }
  return entries;
}

/**
 * 用原生正则提取详情页的 overview 与 infobox（不依赖第三方选择器）。
 *
 * - overview：正文区首段（.mw-parser-output 内第一个 <p>）的纯文本。
 * - infobox：属性信息表（含「身高」「体重」等）的纯文本，供 parseHeight 等继续解析。
 *
 * 两者的清理都走统一的 {@link cleanHtml}（stripTags 模式）。
 *
 * @param html - 详情页完整 HTML
 * @returns { overview?, infobox? } 提取结果
 */
function parseDetail(html: string): { overview?: string; infobox?: string } {
  const parserOut = cleanHtml(html, { from: '<div class="mw-parser-output"' });
  const overviewMatch = parserOut.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  const overview = overviewMatch ? cleanHtml(overviewMatch[1], { stripTags: true }) : '';

  const infoMatch = html.match(/<table[^>]*class="[^"]*roundy[^"]*"[^>]*>([\s\S]*?)<\/table>/i);
  const infobox = infoMatch ? cleanHtml(infoMatch[1], { stripTags: true }) : '';

  // exactOptionalPropertyTypes：仅当非空时才携带键，避免显式 undefined 赋给可选字段。
  const result: { overview?: string; infobox?: string } = {};
  if (overview) result.overview = overview;
  if (infobox) result.infobox = infobox;
  return result;
}

function normalizeDetailUrl(rawUrl: string | undefined): string {
  if (!rawUrl) return '';

  let url: URL;
  try {
    url = new URL(rawUrl, 'https://wiki.52poke.com');
  } catch {
    return '';
  }
  if (url.host !== 'wiki.52poke.com') return '';
  if (!url.pathname.startsWith('/wiki/')) return '';
  if (url.pathname.includes(':')) return '';
  if (url.pathname.includes('（属性）')) return '';
  return url.href;
}

/** 身高（米）。单位固化在字段名，返回裸数值，不做 `{ value, unit }` 包装。 */
function parseHeight(text: string): number | undefined {
  const m = text.match(/身高\s*([\d.]+)\s*m/);
  return m ? Number(m[1]) : undefined;
}

/** 体重（千克）。 */
function parseWeight(text: string): number | undefined {
  const m = text.match(/体重\s*([\d.]+)\s*kg/);
  return m ? Number(m[1]) : undefined;
}

/** 捕获率（原始整数值）。 */
function parseCatchRate(text: string): number | undefined {
  const m = text.match(/捕获率[^\d]*(\d+)/);
  return m ? Number(m[1]) : undefined;
}

/** 性别比例（百分数）。调用方拆成 genderMale / genderFemale 两个一级字段落盘。 */
function parseGenderRatio(text: string): { male: number; female: number } | undefined {
  const male = text.match(/雄性[^\d]*([\d.]+)%/);
  const female = text.match(/雌性[^\d]*([\d.]+)%/);
  if (!male || !female) return undefined;
  return { male: Number(male[1]), female: Number(female[1]) };
}

/** 特性名列表（去重）。返回 `string[]`，不包 `{ name }`。 */
function parseAbilities(text: string): string[] {
  const region = text.slice(text.indexOf('特性'), text.indexOf('100级'));
  const names = [...region.matchAll(/([\u4e00-\u9fa5]+)/g)]
    .map(m => m[1])
    .filter(n => n !== '特性' && n !== '隐藏特性');
  return [...new Set(names)];
}
