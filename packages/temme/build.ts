import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

import peggy from 'peggy';

const srcPeggyDir = fileURLToPath(new URL('./src-peggy', import.meta.url));
const input = [
  'grammar.peggy',
  'selector.peggy',
  'css.peggy',
  'capture-filter.peggy',
  'literal.peggy',
  'js.peggy',
  'whitespace.peggy',
  'unicode.peggy',
].map(part => readFileSync(resolve(srcPeggyDir, part), 'utf8'));

const source = peggy.generate(input.join('\n'), {
  output: 'source',
  format: 'es',
});

// peggy 产物输出到 src/compile/parse.js（运行时 parser）；
// 配套类型手写固定在 src/compile/parse.d.ts，不参与覆盖。编译能力由 src/compile/index.ts 纯出口汇聚。
const compileDir = fileURLToPath(new URL('./src/compiler', import.meta.url));
mkdirSync(compileDir, { recursive: true });
writeFileSync(resolve(compileDir, 'parse.js'), source, 'utf8');

console.log('[build-grammar] peggy parser emitted to src/compile/parse.js');
