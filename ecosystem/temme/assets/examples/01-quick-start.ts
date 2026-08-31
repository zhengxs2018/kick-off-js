/**
 * 01 - 快速上手：一次性抽取（字符串规则 / 手写 AST）
 *
 * 运行（node 24+，需先 npm i @zhengxs/temme）：
 *   node --experimental-strip-types ./01-quick-start.ts
 */
import { parse, temme } from '@zhengxs/temme';
import type { Capture, TemmeSelector } from '@zhengxs/temme';

const html = `
<table class="list">
  <tbody>
    <tr><td class="id">1</td><td class="name">麻黄</td><td class="price">12.5</td></tr>
    <tr><td class="id">2</td><td class="name">桂枝</td><td class="price">8</td></tr>
    <tr><td class="id">3</td><td class="name">黄连</td><td class="price">9.8</td></tr>
  </tbody>
</table>`;

// 方式 A：字符串规则 + parse。
// 注意捕获语义：`td.id $id` 是【标量】捕获（默认 text 过程，命中多项时保留第一个匹配），
// 需要【数组】累积时用 `arrayCapture`（见下 tr $row 写法）。
const rule = 'td.id $id:int; td.name $name; td.price $price:number';
const resultA = temme(html, parse(rule));
console.log('方式A（字符串规则，标量捕获）：', JSON.stringify(resultA));
// { "id": 1, "name": "麻黄", "price": 12.5 } —— 每键只保留第一个匹配

// 字符串规则的【数组】捕获：整行作数组捕获（命中多项 append），子选择器作标量捕获。
const arrayRule = 'tr $row { td.id $id:int; td.name $name }';
const resultA2 = temme(html, parse(arrayRule));
console.log('方式A2（字符串规则，数组捕获）：', JSON.stringify(resultA2));
// { "row": ["1麻黄12.5", "2桂枝8", "3黄连9.8"], "id": 1, "name": "麻黄" }
//   row 为数组（每行 text 拼接、按文档正序），id/name 为每个 tr 内子选择器的标量捕获（取第一个）

// 方式 B：手写 AST（数组捕获）。
// 数组捕获：匹配所有 <element.className>，把 textContent 累积为数组。
function capture(name: string, extra: Partial<Capture> = {}): Capture {
  return { name, typeAnnotation: null, filterList: null, modifier: null, ...extra };
}

function arrayTextSelector(element: string, className: string, cap: Capture): TemmeSelector {
  return {
    type: 'normal-selector',
    sections: [{ combinator: ' ', element, qualifiers: [{ type: 'class-qualifier', className }] }],
    procedure: null, // 未指定过程，默认取 text
    arrayCapture: cap,
    children: [],
  };
}

const selectors: TemmeSelector[] = [
  arrayTextSelector('td', 'id', capture('id', { typeAnnotation: ['int'] })),
  arrayTextSelector('td', 'name', capture('name')),
  arrayTextSelector('td', 'price', capture('price', { typeAnnotation: ['number'] })),
];

const resultB = temme(html, selectors);
console.log('方式B（手写 AST，数组捕获）：', JSON.stringify(resultB));
// { "id": [1, 2, 3], "name": ["麻黄", "桂枝", "黄连"], "price": [12.5, 8, 9.8] }
// 数组捕获按文档正序累积（drive 按文档序正序遍历写捕获）。
