import { describe, it, expect } from 'bun:test';
import { linkedom } from '../src/parsers/index.js';
import { createEngine } from '../src/runtime/index.js';
import type { PlanNode } from '../src/compiler/index.js';

/**
 * linkedom 默认适配器基础查询行为：标准 W3C DOM 作用域匹配 + 过程取值。
 *
 * 仅验证契约承诺行为，不假设 linkedom 内部实现。
 */

describe('linkedom 适配器解析与匹配', () => {
  const adapter = linkedom();

  it('parseFromString 接受 HTML 字符串返回根节点', () => {
    const root = adapter.parseFromString('<html><body><p>hi</p></body></html>', 'text/html');
    expect(root).toBeTruthy();
    expect(root.native).toBeTruthy();
  });

  it('match 在作用域内按 CSS 选择器匹配（嵌套作用域不污染）', () => {
    const html = `<div class="outer"><span>1</span><div class="inner"><span>2</span></div></div>`;
    const root = adapter.parseFromString(html, 'text/html');
    const outer = [...adapter.match('.outer', root)][0];
    const innerSpans = [...adapter.match('span', outer)];

    expect(innerSpans.length).toBe(2);
    expect(innerSpans.map(n => n.extract('text', [])).sort()).toEqual(['1', '2']);
  });

  it('getElementsByClassName 原生直取', () => {
    const root = adapter.parseFromString(
      '<div><i class="a">1</i><i class="a">2</i><i class="b">3</i></div>',
      'text/html',
    );
    const found = [...adapter.getElementsByClassName('a', root)];
    expect(found.length).toBe(2);
  });

  it('getElementById 命中返回节点，未命中返回 null', () => {
    const root = adapter.parseFromString('<div id="main">x</div>', 'text/html');
    expect(adapter.getElementById('main', root)).not.toBeNull();
    expect(adapter.getElementById('missing', root)).toBeNull();
  });

  it('getElementsByTagName 原生直取', () => {
    const root = adapter.parseFromString('<ul><li>1</li><li>2</li></ul>', 'text/html');
    expect([...adapter.getElementsByTagName('li', root)].length).toBe(2);
  });
});

describe('linkedom 适配器节点 parent 上溯', () => {
  const adapter = linkedom();

  it('parent() 返回父节点，根节点返回 null', () => {
    const root = adapter.parseFromString('<section><p>txt</p></section>', 'text/html');
    const p = [...adapter.match('p', root)][0];
    const parent = p.parent();

    expect(parent).not.toBeNull();
    expect(parent?.extract('text', [])).toContain('txt');
    expect(root.parent()).toBeNull();
  });
});

describe('linkedom 适配器过程取值', () => {
  const engine = createEngine(linkedom());

  it('text 返回 textContent，缺文本返回空串', () => {
    const node = [
      ...engine.select(
        { parentId: null, css: 'div', captures: [], children: [] } as PlanNode,
        engine.parse('<div></div>'),
      ),
    ][0];
    expect(node.extract('text', [])).toBe('');
  });

  it('html 返回 innerHTML', () => {
    const node = [
      ...engine.select(
        { parentId: null, css: 'div', captures: [], children: [] } as PlanNode,
        engine.parse('<div><b>x</b></div>'),
      ),
    ][0];
    expect(node.extract('html', [])).toBe('<b>x</b>');
  });

  it('attr 返回属性值，缺失返回 null', () => {
    const node = [
      ...engine.select(
        { parentId: null, css: 'a', captures: [], children: [] } as PlanNode,
        engine.parse('<a href="/p">t</a>'),
      ),
    ][0];
    expect(node.extract('attr', ['href'])).toBe('/p');
    expect(node.extract('attr', ['title'])).toBeNull();
  });
});
