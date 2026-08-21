import { createWriteStream } from 'node:fs';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { WriteStream } from 'node:fs';
import type { StreamStorage } from './stream.js';
import { createStreamStorage } from './stream.js';
import type { StandardSchemaV1 } from '../common/schema.js';

/**
 * 创建 jsonl 文件流式存储
 *
 * @param schema - 可选，传入则写入前校验；不传则按 Record<string, unknown> 直接落盘
 */
export function createJsonlStorage<T = Record<string, unknown>>(
  file = resolve(process.cwd(), 'data', 'storage.jsonl'),
  schema?: StandardSchemaV1<unknown, T>  ,
): StreamStorage<T> {
  let writer: WriteStream | undefined;

  return createStreamStorage<T>(
    {
      start() {
        mkdirSync(dirname(file), { recursive: true });
        writer = createWriteStream(file, { flags: 'a' });
      },
      write(chunk) {
        writer!.write(`${JSON.stringify(chunk)}\n`);
      },
      close() {
        const w = writer;
        if (!w) return;

        return new Promise<void>((resolve, reject) => {
          w.end(() => resolve());
          w.once('error', reject);
        });
      },
    },
    schema,
  );
}
