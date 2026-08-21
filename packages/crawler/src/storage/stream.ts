import { SchemaValidationError } from '../common/errors.js';
import type { StandardSchemaV1 } from '../common/schema.js';

export interface StreamSink<T> {
  start?(): void | Promise<void>;
  write(chunk: T): void | Promise<void>;
  close?(): void | Promise<void>;
}

export interface StreamStorage<T> extends AsyncDisposable {
  write(chunk: T): Promise<void>;
}

/**
 * 把任意 sink 封装为可 `await using` 的异步写端存储
 *
 * @param schema - 可选，传入则写入前校验；不传则直接放行
 */
export function createStreamStorage<T = unknown>(
  underlyingSink?: UnderlyingSink<T>  ,
  schema?: StandardSchemaV1<unknown, T>  ,
): StreamStorage<T> {
  const stream = new WritableStream<T>(underlyingSink);

  const writer = stream.getWriter();

  return {
    write(chunk) {
      return writer.write(validateSchema(schema, chunk));
    },
    async [Symbol.asyncDispose]() {
      await writer.close();
    },
  };

  function validateSchema(s: StandardSchemaV1<unknown, T> | undefined, value: T): T {
    if (s === undefined) {
      return value;
    }
    const result = s['~standard'].validate(value);
    if (result.issues !== undefined) {
      throw new SchemaValidationError(result.issues, value);
    }
    return result.value;
  }
}
