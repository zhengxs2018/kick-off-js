/**
 * 04 - 爬虫/ETL 管线：按页驱动同一计划，产出结构化记录数组
 *
 * 运行（node 24+，需先 npm i @zhengxs/temme）：
 *   node --experimental-strip-types ./04-crawl-pipeline.ts
 *
 * 模式：爬虫每拿到一页 HTML 就用同一份编译计划抽取，收集为记录数组，供下游清洗/入库。
 */
import { compile, temme } from '@zhengxs/temme';
import type { Capture, TemmeSelector } from '@zhengxs/temme';

function capture(name: string, extra: Partial<Capture> = {}): Capture {
  return { name, typeAnnotation: null, filterList: null, modifier: null, ...extra };
}

function arrayTextSelector(element: string, className: string, cap: Capture): TemmeSelector {
  return {
    type: 'normal-selector',
    sections: [{ combinator: ' ', element, qualifiers: [{ type: 'class-qualifier', className }] }],
    procedure: null,
    arrayCapture: cap,
    children: [],
  };
}

// 编译一次，多页复用
const plan = compile([
  arrayTextSelector('td', 'id', capture('id', { typeAnnotation: ['int'] })),
  arrayTextSelector('td', 'name', capture('name')),
]);

// 模拟爬虫抓到的多页 HTML（真实场景来自网络请求）
const pages = [
  `<table><tr><td class="id">1</td><td class="name">麻黄</td></tr></table>`,
  `<table><tr><td class="id">2</td><td class="name">桂枝</td></tr></table>`,
  `<table><tr><td class="id">3</td><td class="name">黄连</td></tr></table>`,
];

// 每页抽取为"同键数组"，再转成记录数组
function toRecords(pageResult: Record<string, unknown>): Array<Record<string, unknown>> {
  const { id, name } = pageResult as { id: number[]; name: string[] };
  const count = Math.min(id.length, name.length);
  return Array.from({ length: count }, (_v, i) => ({ id: id[i], name: name[i] }));
}

const allRecords: Array<Record<string, unknown>> = [];
for (const html of pages) {
  const extracted = temme(html, plan); // 复用编译计划
  allRecords.push(...toRecords(extracted));
}

console.log('汇总记录：', JSON.stringify(allRecords, null, 2));
// [{ id: 1, name: '麻黄' }, { id: 2, name: '桂枝' }, { id: 3, name: '黄连' }]
// 注：数组捕获是文档逆序，本模式单页单行，按 toRecords 对齐取用。
