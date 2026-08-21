import { describe, it, expect } from 'bun:test';
import { JSDOM } from 'jsdom';
import { domParser } from '../src/parsers/index.js';
import { createEngine } from '../src/runtime/index.js';
import type { PlanNode } from '../src/compiler/index.js';

/**
 * domParser：基于原生 `DOMParser` 的适配器。
 *
 * bun 运行时无全局 `DOMParser` / `CSS.escape`，故在模块加载时用 jsdom 的 window 补齐这两个全局，
 * 使 `domParser()` 的浏览器后端可在 bun 下验证。覆盖解析、CSS 匹配、class/id/tag 原生直取、
 * parent 上溯与过程取值（text / html / node / attr）。
 */

// 模块加载时即补齐全局，保证下文 `domParser()` 创建可用
const { window } = new JSDOM('<!doctype html><html><body></body></html>');
Object.assign(globalThis, {
  DOMParser: window.DOMParser,
  CSS: window.CSS,
});

const adapter = domParser();

describe('domParser 解析与匹配', () => {
  it('parseFromString 返回根节点', () => {
    const root = adapter.parseFromString('<p>hi</p>', 'text/html');
    expect(root).toBeTruthy();
    expect(root.native).toBeTruthy();
  });

  it('match 在作用域内按 CSS 选择器匹配（嵌套作用域不污染）', () => {
    const root = adapter.parseFromString(
      '<div class="outer"><span>1</span><div class="inner"><span>2</span></div></div>',
      'text/html',
    );
    const outer = [...adapter.match('.outer', root)][0];
    const innerSpans = [...adapter.match('span', outer)];

    expect(innerSpans.length).toBe(2);
    expect(innerSpans.map(n => n.extract('text', [])).sort()).toEqual(['1', '2']);
  });

  it('无匹配返回空序列', () => {
    const root = adapter.parseFromString('<div></div>', 'text/html');
    expect([...adapter.match('span', root)].length).toBe(0);
  });
});

describe('domParser 原生直取快路径', () => {
  const html =
    '<div id="main"><i class="a">1</i><i class="a">2</i><i class="b">3</i><em>e</em></div>';

  it('getElementsByClassName 按 class 直取', () => {
    const root = adapter.parseFromString(html, 'text/html');
    const found = [...adapter.getElementsByClassName('a', root)];
    expect(found.length).toBe(2);
  });

  it('getElementById 命中返回节点，未命中返回 null', () => {
    const root = adapter.parseFromString(html, 'text/html');
    expect(adapter.getElementById('main', root)).not.toBeNull();
    expect(adapter.getElementById('missing', root)).toBeNull();
  });

  it('getElementById 对含特殊字符 id 用 CSS.escape 转义后命中', () => {
    const root = adapter.parseFromString('<div id="a:b">x</div>', 'text/html');
    expect(adapter.getElementById('a:b', root)).not.toBeNull();
  });

  it('getElementsByTagName 按标签名直取', () => {
    const root = adapter.parseFromString(html, 'text/html');
    const em = [...adapter.getElementsByTagName('em', root)];
    expect(em.length).toBe(1);
    expect(em[0].extract('text', [])).toBe('e');
  });

  it('集合 item 越界返回 null，界内返回节点', () => {
    const root = adapter.parseFromString('<i class="a">1</i>', 'text/html');
    const collection = adapter.getElementsByClassName('a', root);
    expect(collection.length).toBe(1);
    expect(collection.item(0)).not.toBeNull();
    expect(collection.item(5)).toBeNull();
  });

  it('createNode 包装原生节点', () => {
    const root = adapter.parseFromString('<b>bold</b>', 'text/html');
    const node = [...adapter.match('b', root)][0];
    const wrapped = adapter.createNode(node.native as Element);
    expect(wrapped.extract('text', [])).toBe('bold');
  });
});

describe('domParser 节点 parent 上溯', () => {
  it('parent() 逐级返回父节点，直至文档根 <html>', () => {
    const root = adapter.parseFromString('<section><p>txt</p></section>', 'text/html');
    const p = [...adapter.match('p', root)][0];

    const section = p.parent();

    expect(section).not.toBeNull();
    expect(section?.extract('text', [])).toContain('txt');

    // domParser 的 parseFromString 包装 body：p → section → body → html，html 的 parent 为 null
    const body = section?.parent();
    expect(body).not.toBeNull();
    const html = body?.parent();
    expect(html).not.toBeNull();
    expect(html?.parent()).toBeNull();
  });
});

describe('domParser 过程取值（text / html / node / attr）', () => {
  const engine = createEngine(adapter);

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

  it('node 返回原生元素', () => {
    const node = [
      ...engine.select(
        { parentId: null, css: 'span', captures: [], children: [] } as PlanNode,
        engine.parse('<span class="n">t</span>'),
      ),
    ][0];
    const native = node.extract('node', []) as Element;
    expect(native.className).toBe('n');
  });

  it('attr 返回属性值，缺失返回 null，缺属性名返回 null', () => {
    const node = [
      ...engine.select(
        { parentId: null, css: 'a', captures: [], children: [] } as PlanNode,
        engine.parse('<a href="/p">t</a>'),
      ),
    ][0];
    expect(node.extract('attr', ['href'])).toBe('/p');
    expect(node.extract('attr', ['title'])).toBeNull();
    expect(node.extract('attr', [])).toBeNull();
  });

  it('未识别过程名返回 undefined（fail-safe no-op）', () => {
    const node = [
      ...engine.select(
        { parentId: null, css: 'div', captures: [], children: [] } as PlanNode,
        engine.parse('<div>x</div>'),
      ),
    ][0];
    expect(node.extract('unknown', [])).toBeUndefined();
  });
});
