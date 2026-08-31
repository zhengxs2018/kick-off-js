/**
 * 05 - 三种形态的规则 + extractor 分层使用
 *
 * 运行（node 24+，需先 npm i @zhengxs/temme）：
 *   node --experimental-strip-types ./05-three-forms.ts
 *
 * 三种形态（`selectorsOrPlan` 输入类型不同，管线深度不同）：
 *   1. 字符串规则：parse(rule) → AST，最简洁，适合规则固定、抽一次。
 *   2. 手写 AST：   TemmeSelector[]，适合规则程序化生成 / 从远程还原。
 *   3. 执行计划：   compile(selectors) → ExecutionPlan，可序列化/复用，跳过 compile。
 *
 * extractor 四阶段（createExtractor 暴露，便于手动控制 parse→link→drive 各阶段）：
 *   load(html) → 解析文档（一次）
 *   select(doc, selectors) → AST → compile → link → drive（含 compile）
 *   extract(doc, plan)     → ExecutionPlan → link → drive（跳过 compile）
 *   execute(doc, linkedPlan) → LinkedPlan → drive（跳过 compile + link，最快）
 */
import { compile, createEnv, createExtractor, link, parse, serialize } from '@zhengxs/temme';
import type { Capture, ExecutionPlan, TemmeSelector } from '@zhengxs/temme';
import type { Env } from '@zhengxs/temme';
import type { LinkedPlan } from '@zhengxs/temme/runtime';

const html = `
<table class="list">
  <tbody>
    <tr><td class="id">1</td><td class="name">麻黄</td><td class="price">12.5</td></tr>
    <tr><td class="id">2</td><td class="name">桂枝</td><td class="price">8</td></tr>
  </tbody>
</table>`;

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

// === 形态 1：字符串规则 ===
const rule = 'td.id $id:int; td.name $name';
const env = createEnv();
const extractor = createExtractor({ env });

const doc = extractor.load(html); // 解析一次，供各形态复用
const viaString = extractor.select(doc, parse(rule)); // 含 parse + compile + link + drive
console.log('形态1 字符串规则：', JSON.stringify(viaString));

// === 形态 2：手写 AST ===
const selectors: TemmeSelector[] = [
  arrayTextSelector('td', 'id', capture('id', { typeAnnotation: ['int'] })),
  arrayTextSelector('td', 'name', capture('name')),
];
const viaAst = extractor.select(doc, selectors); // 跳过 parse，含 compile
console.log('形态2 手写 AST：', JSON.stringify(viaAst));

// === 形态 3：预编译执行计划（可序列化、跨页复用）===
const plan: ExecutionPlan = compile(selectors); // 一次 compile
const json = serialize(plan); // 可存库/传输
console.log('形态3 序列化节选：', json.slice(0, 60), '…');
const viaPlan = extractor.extract(doc, plan); // 跳过 compile，每次 link + drive
console.log('形态3 执行计划：', JSON.stringify(viaPlan));

// === extractor 第四阶段：预链接计划（跳过 compile + link，最快）===
// link(plan, env) → LinkedPlan；execute 只跑 drive。同模板多页时这一层收益最大。
const linked: LinkedPlan = link(plan, env);
const viaLinked = extractor.execute(doc, linked); // 仅 drive
console.log('extractor.execute（仅 drive）：', JSON.stringify(viaLinked));
