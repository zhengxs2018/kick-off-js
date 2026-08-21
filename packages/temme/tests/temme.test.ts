import { describe, it, expect } from 'bun:test';
import { temme } from '../src/temme.js';
import { compile, parse } from '../src/compiler/index.js';
import { createEngine, createEnv } from '../src/runtime/index.js';
import { linkedom } from '../src/parsers/index.js';
import type { Capture, NormalSelector } from '../src/compiler/index.js';

/**
 * temme：顶层一次性抽取入口的三态分发契约。
 *
 * 按第二参形态分发到 extractor 的不同能力：
 * - string → parse 后 select（字符串规则）
 * - TemmeSelector[] → select（手写 AST）
 * - ExecutionPlan → extract（复用已编译计划）
 * 另覆盖 options 注入 env（扩展点）与 parser（换 DOM 后端）的行为。
 */

const HTML =
  '<div class="card"><span class="name">麻黄</span><span class="price">12.5</span></div>';

function capture(name: string, extra: Partial<Capture> = {}): Capture {
  return { name, typeAnnotation: null, filterList: null, modifier: null, ...extra };
}

function textSelector(className: string, captureName: string): NormalSelector {
  return {
    type: 'normal-selector',
    sections: [
      { combinator: ' ', element: 'span', qualifiers: [{ type: 'class-qualifier', className }] },
    ],
    procedure: { name: 'text', args: [capture(captureName)] },
    arrayCapture: null,
    children: [],
  };
}

describe('temme 字符串规则（parse 分发）', () => {
  it('从 HTML 抽取命名字段', () => {
    const result = temme(HTML, '.name $name');
    expect(result).toEqual({ name: '麻黄' });
  });

  it('字符串规则 + 类型注解生效', () => {
    const result = temme(HTML, '.price $price:number');
    expect(result).toEqual({ price: 12.5 });
  });

  it('空字符串规则返回空对象', () => {
    const result = temme('<div></div>', '');
    expect(result).toEqual({});
  });
});

describe('temme 手写 AST（select 分发）', () => {
  it('抽取多个捕获', () => {
    const selectors = [textSelector('name', 'name'), textSelector('price', 'price')];
    const result = temme(HTML, selectors);
    expect(result).toEqual({ name: '麻黄', price: '12.5' });
  });

  it('可复用同一 AST 抽取多页', () => {
    const selectors = [textSelector('name', 'name')];
    const page1 = temme('<div><span class="name">麻黄</span></div>', selectors);
    const page2 = temme('<div><span class="name">桂枝</span></div>', selectors);
    expect(page1).toEqual({ name: '麻黄' });
    expect(page2).toEqual({ name: '桂枝' });
  });
});

describe('temme 编译计划（extract 分发）', () => {
  it('compile 出的计划可直接抽取', () => {
    const plan = compile([textSelector('name', 'name')]);
    const result = temme(HTML, plan);
    expect(result).toEqual({ name: '麻黄' });
  });

  it('parse + compile 后复用计划', () => {
    const plan = compile(parse('.name $name'));
    const result = temme(HTML, plan);
    expect(result).toEqual({ name: '麻黄' });
  });
});

describe('temme options 注入', () => {
  it('env 注入自定义 procedure', () => {
    const env = createEnv({
      procedures: {
        toYuan(input: unknown) {
          const n = Number(String(input).replace(/[^0-9.]/g, ''));
          return Number.isFinite(n) ? n : undefined;
        },
      },
    });
    const selectors: NormalSelector[] = [
      {
        type: 'normal-selector',
        sections: [
          {
            combinator: ' ',
            element: 'span',
            qualifiers: [{ type: 'class-qualifier', className: 'price' }],
          },
        ],
        procedure: { name: 'toYuan', args: [capture('price', { typeAnnotation: ['number'] })] },
        arrayCapture: null,
        children: [],
      },
    ];
    const result = temme(HTML, selectors, { env });
    expect(result).toEqual({ price: 12.5 });
  });

  it('options 的 procedures 直接传给 createEnv', () => {
    const selectors: NormalSelector[] = [
      {
        type: 'normal-selector',
        sections: [
          {
            combinator: ' ',
            element: 'span',
            qualifiers: [{ type: 'class-qualifier', className: 'name' }],
          },
        ],
        procedure: { name: 'upper', args: [capture('name')] },
        arrayCapture: null,
        children: [],
      },
    ];
    const result = temme(HTML, selectors, {
      procedures: {
        upper(v: unknown) {
          return String(v).toUpperCase();
        },
      },
    });
    expect(result).toEqual({ name: '麻黄'.toUpperCase() });
  });

  it('接收已解析的 TemmeNode 文档作为输入', () => {
    const engine = createEngine(linkedom());
    const document = engine.parse(HTML);
    const result = temme(document, '.name $name');
    expect(result).toEqual({ name: '麻黄' });
  });
});
