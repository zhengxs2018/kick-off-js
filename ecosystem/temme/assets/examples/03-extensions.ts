/**
 * 03 - 扩展点：自定义 procedure / filter / modifier + 类型注解 + 空白策略
 *
 * 运行（node 24+，需先 npm i @zhengxs/temme）：
 *   node --experimental-strip-types ./03-extensions.ts
 *
 * 说明：
 * - procedure 对捕获值做领域解析（如价格串→数字），输入取 text。
 * - filter 做纯变换，返回 undefined 时跳过该捕获（可当"脏数据过滤"）。
 * - modifier 直接改写捕获状态。
 * - 非内置扩展点在 link 阶段绑定为闭包，未注册名运行期静默跳过。
 */
import { createEnv, temme } from '@zhengxs/temme';
import type { Capture, TemmeSelector } from '@zhengxs/temme';

function capture(name: string, extra: Partial<Capture> = {}): Capture {
  return { name, typeAnnotation: null, filterList: null, modifier: null, ...extra };
}

// 注入扩展能力
const env = createEnv({
  procedures: {
    toYuan(input: unknown) {
      const n = Number(String(input).replace(/[^0-9.]/g, ''));
      return Number.isFinite(n) ? n : undefined; // 解析失败返回 undefined → 跳过写入
    },
  },
  filters: {
    stripTags(v: unknown) {
      return String(v).replace(/<[^>]*>/g, '');
    },
  },
  whitespace: 'preserve', // 保留原文空白（清洗默认 condense）
});

const html = `
<div class="card">
  <div class="title">麻黄 <em>（蜜炙）</em></div>
  <div class="price">¥ 12.5</div>
</div>
`;

const selectors: TemmeSelector[] = [
  {
    type: 'normal-selector',
    sections: [
      {
        combinator: ' ',
        element: 'div',
        qualifiers: [{ type: 'class-qualifier', className: 'title' }],
      },
    ],
    procedure: {
      name: 'html',
      args: [
        capture('title', { filterList: [{ isArrayFilter: false, name: 'stripTags', args: [] }] }),
      ],
    },
    arrayCapture: null,
    children: [],
  },
  {
    type: 'normal-selector',
    sections: [
      {
        combinator: ' ',
        element: 'div',
        qualifiers: [{ type: 'class-qualifier', className: 'price' }],
      },
    ],
    procedure: { name: 'toYuan', args: [capture('price', { typeAnnotation: ['number'] })] },
    arrayCapture: null,
    children: [],
  },
];

const result = temme(html, selectors, { env });
console.log(JSON.stringify(result, null, 2));
// whitespace=preserve 时保留原文空白：{ title: '麻黄 （蜜炙）', price: 12.5 }
// 若用默认 condense，空白被折叠，title 为 '麻黄 蜜炙'
