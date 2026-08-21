import { describe, it, expect } from 'bun:test';
import { compile, parse, serialize, deserialize } from '../src/compiler/index.js';
import type {
  Assignment,
  Capture,
  DefineSelector,
  Filter,
  NormalSelector,
  ParentRefSelector,
  Procedure,
  SnippetDefine,
  SnippetExpand,
  SyntaxError,
} from '../src/compiler/index.js';

/**
 * parse：把纯字符串规则文本解析为 `TemmeSelector[]` AST 的契约行为。
 *
 * 覆盖语法层各节点形态（normal-selector / parent-ref / assignment / snippet / define）、
 * 捕获标注（类型注解、|filter / ||filter、@modifier 链、裸 $ 默认键）与字面量（正则 / 数字 / 布尔 / 字符串），
 * 并验证 parse 产物可直接喂给 compile 产出可序列化执行计划。
 */

function singleCapture(ast: ReturnType<typeof parse>): Capture {
  const sel = ast[0] as NormalSelector;
  const proc = sel.procedure as Procedure;
  return proc.args[0] as Capture;
}

describe('parse 普通选择器与捕获', () => {
  it('div .name $name 归约为 text 过程 + 命名捕获', () => {
    const ast = parse('div .name $name');
    const sel = ast[0] as NormalSelector;

    expect(sel.type).toBe('normal-selector');
    expect(sel.sections).toEqual([
      { combinator: ' ', element: 'div', qualifiers: [] },
      {
        combinator: ' ',
        element: '*',
        qualifiers: [{ type: 'class-qualifier', className: 'name' }],
      },
    ]);
    const cap = singleCapture(ast);
    expect(cap.name).toBe('name');
    expect(cap.typeAnnotation).toBeNull();
    expect(cap.filterList).toBeNull();
    expect(cap.modifier).toBeNull();
  });

  it('裸 $ 归约为默认捕获键', () => {
    const cap = singleCapture(parse('span.title $'));
    expect(cap.name).toBe('@@default-capture@@');
  });

  it('类型注解累积为 string[]（:number:int）', () => {
    const cap = singleCapture(parse('div $n:number:int'));
    expect(cap.typeAnnotation).toEqual(['number', 'int']);
  });

  it('|filter 归约为标量过滤器，链按序累积', () => {
    const cap = singleCapture(parse('div $v|trim|upper'));
    expect(cap.filterList).toEqual([
      { isArrayFilter: false, name: 'trim', args: [] },
      { isArrayFilter: false, name: 'upper', args: [] },
    ]);
  });

  it('||filter 归约为数组过滤器', () => {
    const cap = singleCapture(parse('div $x||trim'));
    expect(cap.filterList).toEqual([{ isArrayFilter: true, name: 'trim', args: [] }]);
  });

  it('@modifier 链合并为单个 { isModifier, modifiers }', () => {
    const cap = singleCapture(parse('div $v @m1 @m2'));
    expect(cap.filterList).toEqual([{ isModifier: true, modifiers: ['m1', 'm2'] }]);
  });

  it('过滤器与修饰符链可共存', () => {
    const cap = singleCapture(parse('div $v|trim @m1'));
    expect(cap.filterList).toEqual([
      { isArrayFilter: false, name: 'trim', args: [] },
      { isModifier: true, modifiers: ['m1'] },
    ]);
  });
});

describe('parse 其它选择器形态', () => {
  it('& span $t 归约为父引用选择器', () => {
    const ast = parse('& span $t');
    const sel = ast[0] as ParentRefSelector;

    expect(sel.type).toBe('parent-ref-selector');
    expect(sel.section).toEqual({ combinator: ' ', element: 'span', qualifiers: [] });
    expect(sel.procedure).toEqual({
      name: 'text',
      args: [{ name: 't', typeAnnotation: null, filterList: null, modifier: null }],
    });
  });

  it('& find($x) 父引用带过程，参数为嵌套捕获', () => {
    const ast = parse('& find($x)');
    const sel = ast[0] as ParentRefSelector;

    expect(sel.type).toBe('parent-ref-selector');
    expect(sel.procedure).toEqual({
      name: 'find',
      args: [{ name: 'x', typeAnnotation: null, filterList: null, modifier: null }],
    });
  });

  it('$k = 42 归约为赋值语句', () => {
    const ast = parse('$k = 42');
    const sel = ast[0] as Assignment;

    expect(sel.type).toBe('assignment');
    expect(sel.capture.name).toBe('k');
    expect(sel.value).toBe(42);
  });

  it('字面量赋值：字符串 / 布尔 / 正则', () => {
    expect((parse("$k = 'hello'")[0] as Assignment).value).toBe('hello');
    expect((parse('$k = true')[0] as Assignment).value).toBe(true);
    const regex = parse('$k = /\\d+/g')[0] as Assignment;
    expect(regex.value).toBeInstanceOf(RegExp);
    expect((regex.value as RegExp).source).toBe('\\d+');
    expect((regex.value as RegExp).flags).toBe('g');
  });

  it('@snip = {...} 归约为片段定义', () => {
    const ast = parse('@snip = { a $x }');
    const sel = ast[0] as SnippetDefine;

    expect(sel.type).toBe('snippet-define');
    expect(sel.name).toBe('snip');
    const child = sel.selectors[0] as NormalSelector;
    expect(child.sections).toEqual([{ combinator: ' ', element: 'a', qualifiers: [] }]);
    expect((child.procedure as Procedure).args[0]).toMatchObject({ name: 'x' });
  });

  it('@snip; 归约为片段展开', () => {
    const sel = parse('@snip;')[0] as SnippetExpand;
    expect(sel.type).toBe('snippet-expand');
    expect(sel.name).toBe('snip');
  });

  it('filter / modifier / procedure 定义归约为 DefineSelector', () => {
    const filterDefine = parse('filter f(a) { return a }')[0] as DefineSelector;
    expect(filterDefine).toEqual({
      type: 'filter-define',
      name: 'f',
      argsPart: 'a',
      code: ' return a ',
    });

    const modifierDefine = parse('modifier m(a) { state }')[0] as DefineSelector;
    expect(modifierDefine.type).toBe('modifier-define');

    const procDefine = parse('procedure p(a) { return a }')[0] as DefineSelector;
    expect(procDefine.type).toBe('procedure-define');
    expect(procDefine.name).toBe('p');
  });

  it('子选择器与数组捕获', () => {
    const ast = parse('tr $row { td $x }');
    const sel = ast[0] as NormalSelector;

    expect(sel.arrayCapture).toMatchObject({ name: 'row' });
    const child = sel.children[0] as NormalSelector;
    expect(child.sections).toEqual([{ combinator: ' ', element: 'td', qualifiers: [] }]);
    expect((child.procedure as Procedure).args[0]).toMatchObject({ name: 'x' });
  });

  it('多个选择器以 ; 分隔', () => {
    const ast = parse('div .a $a; span .b $b');
    expect(ast).toHaveLength(2);
    expect((ast[0] as NormalSelector).sections[1]).toMatchObject({
      element: '*',
      qualifiers: [{ type: 'class-qualifier', className: 'a' }],
    });
    expect((ast[1] as NormalSelector).sections[1]).toMatchObject({
      qualifiers: [{ type: 'class-qualifier', className: 'b' }],
    });
  });
});

describe('parse 产物喂给 compile', () => {
  it('compile(parse(rule)) 产出可 serialize 的执行计划', () => {
    const plan = compile(parse('div .name $name'));
    expect(plan.nodes[0]).toMatchObject({
      css: 'div *.name',
      parentId: null,
    });
    const capture = plan.nodes[0]!.captures[0]!;
    expect(capture.name).toBe('name');
    expect(capture.procedureName).toBe('text');

    const json = serialize(plan);
    expect(JSON.parse(json)).toBeTruthy();
  });

  it('含正则的规则经 compile 后 serialize 不丢值', () => {
    const plan = compile(parse('div $v|match(/\\d+/)'));
    const json = serialize(plan);
    expect(json).toContain('"$regex"');
    expect(json).toContain('"source":"\\\\d+"');
    const round = deserialize(json);
    const arg = round.nodes[0]!.captures[0]!.filterList?.[0]!.args[0]!;
    expect(arg).toBeInstanceOf(RegExp);
    expect((arg as RegExp).source).toBe('\\d+');
  });
});

describe('parse 错误路径（SyntaxError）', () => {
  it('非法规则抛出 SyntaxError 并携带 expected / found / location', () => {
    expect(() => parse('[')).toThrow(SyntaxError);

    try {
      parse(']');
      expect.unreachable();
    } catch (e) {
      const err = e as SyntaxError;
      expect(err.name).toBe('SyntaxError');
      expect(Array.isArray(err.expected)).toBe(true);
      expect(err.expected.length).toBeGreaterThan(0);
      expect(err.found).toBe(']');
      expect(err.location.start.line).toBe(1);
      expect(err.location.start.column).toBe(1);
    }
  });

  it('SyntaxError.format(sources) 产出可读诊断文本', () => {
    try {
      parse('[');
      expect.unreachable();
    } catch (e) {
      const err = e as SyntaxError;
      const formatted = err.format([
        { source: undefined, text: '[', offset: 0, line: 1, column: 1 },
      ]);
      expect(formatted).toContain('Error:');
      expect(formatted).toContain('Expected');
      expect(formatted).toContain('1 | [');
    }
  });

  it('空输入 / 纯空白不抛错，解析为空 AST', () => {
    expect(parse('')).toEqual([]);
    expect(parse('   ')).toEqual([]);
    expect(parse('\n\t ')).toEqual([]);
  });
});
