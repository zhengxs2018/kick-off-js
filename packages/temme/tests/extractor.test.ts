import { describe, it, expect } from 'bun:test';
import { createExtractor } from '../src/extractor.js';
import { compile, parse } from '../src/compiler/index.js';
import { createEnv, link } from '../src/runtime/index.js';
import { linkedom } from '../src/parsers/index.js';
import type { Capture, NormalSelector } from '../src/compiler/index.js';

/**
 * createExtractor：四层抽取管线（load / select / extract / execute）契约。
 *
 * - load：HTML 文本 → 文档节点
 * - select：AST（TemmeSelector[]）→ compile → link → drive
 * - extract：执行计划 → link → drive
 * - execute：已链接计划 → drive（纯驱动，无编译/链接开销）
 * 另验证 env 注入自定义过程、缺省 linkedom 解析器可用。
 */

const HTML = '<div class="card"><span class="name">麻黄</span></div>';

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

describe('extractor.load', () => {
  it('把 HTML 文本解析为文档节点', () => {
    const extractor = createExtractor();
    const document = extractor.load(HTML);
    expect(document).toBeTruthy();
  });
});

describe('extractor.select（AST 分发）', () => {
  it('从 AST 抽取命名字段', () => {
    const extractor = createExtractor();
    const document = extractor.load(HTML);
    const result = extractor.select(document, [textSelector('name', 'name')]);
    expect(result).toEqual({ name: '麻黄' });
  });

  it('parse 出的 AST 可喂给 select', () => {
    const extractor = createExtractor();
    const document = extractor.load(HTML);
    const result = extractor.select(document, parse('.name $name'));
    expect(result).toEqual({ name: '麻黄' });
  });
});

describe('extractor.extract（计划分发）', () => {
  it('compile 出的计划可直接抽取', () => {
    const extractor = createExtractor();
    const document = extractor.load(HTML);
    const plan = compile([textSelector('name', 'name')]);
    const result = extractor.extract(document, plan);
    expect(result).toEqual({ name: '麻黄' });
  });
});

describe('extractor.execute（已链接计划分发）', () => {
  it('link 后的计划经 execute 驱动', () => {
    const env = createEnv();
    const extractor = createExtractor({ env });
    const document = extractor.load(HTML);
    const linkedPlan = link(compile([textSelector('name', 'name')]), env);
    const result = extractor.execute(document, linkedPlan);
    expect(result).toEqual({ name: '麻黄' });
  });
});

describe('extractor 四层复用同一环境', () => {
  it('env 注入自定义 procedure 在 select/extract 间一致生效', () => {
    const env = createEnv({
      procedures: {
        upper(v: unknown) {
          return String(v).toUpperCase();
        },
      },
    });
    const extractor = createExtractor({ env });
    const document = extractor.load(HTML);
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

    const plan = compile(selectors);
    expect(extractor.select(document, selectors)).toEqual({ name: '麻黄'.toUpperCase() });
    expect(extractor.extract(document, plan)).toEqual({ name: '麻黄'.toUpperCase() });

    const linkedPlan = link(plan, env);
    expect(extractor.execute(document, linkedPlan)).toEqual({ name: '麻黄'.toUpperCase() });
  });
});

describe('extractor 注入自定义解析器', () => {
  it('显式传 linkedom 解析器可正常抽取', () => {
    const extractor = createExtractor({ parser: linkedom() });
    const document = extractor.load(HTML);
    const result = extractor.select(document, [textSelector('name', 'name')]);
    expect(result).toEqual({ name: '麻黄' });
  });
});
