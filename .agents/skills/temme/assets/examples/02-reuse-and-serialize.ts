/**
 * 02 - 编译复用 + 规则序列化/传输 + schema 边界校验
 *
 * 运行（node 24+，需先 npm i @zhengxs/temme zod）：
 *   node --experimental-strip-types ./02-reuse-and-serialize.ts
 *
 * 说明：zod 是可选 peer 依赖，仅 @zhengxs/temme/schema 用到；不使用 schema 可省略。
 */
import { compile, deserialize, serialize, temme } from '@zhengxs/temme';
import type { Capture, ExecutionPlan, TemmeSelector } from '@zhengxs/temme';
import { parseExecutionPlan } from '@zhengxs/temme/schema';

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

const selectors: TemmeSelector[] = [
  arrayTextSelector('td', 'id', capture('id', { typeAnnotation: ['int'] })),
  arrayTextSelector('td', 'name', capture('name')),
];

// 1. 编译一次（纯 POJO 执行计划，可序列化/传输）
const plan = compile(selectors);

// 2. 序列化入库/发送给其它进程
const json = serialize(plan);
console.log('序列化后的规则（节选）：', json.slice(0, 80), '…');

// 3. 传输到另一端：deserialize 还原，再按需用 schema 校验（校验后即为合法 ExecutionPlan）
const restored = parseExecutionPlan(deserialize(json)) as ExecutionPlan;
console.log('依赖清单 manifest：', JSON.stringify(restored.manifest));

// 4. 同模板多页：复用同一计划反复抽取（跳过 compile）
const page1 = temme(
  `<table><tr><td class="id">1</td><td class="name">麻黄</td></tr></table>`,
  plan,
);
const page2 = temme(
  `<table><tr><td class="id">2</td><td class="name">桂枝</td></tr></table>`,
  restored,
);
console.log('page1:', JSON.stringify(page1));
console.log('page2:', JSON.stringify(page2));
