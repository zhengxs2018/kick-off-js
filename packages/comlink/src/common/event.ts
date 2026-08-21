import { castToError, isAbortError } from './util.js';

export interface Disposable {
  [Symbol.dispose](): void;
}

/**
 * 依次释放所有可释放对象，任一释放报错均收集后统一以 AggregateError 抛出。
 *
 * @param disposables - 待释放的可释放对象集合。
 */
export function disposeAll(disposables: Iterable<Disposable>): void {
  const errors: Error[] = [];

  for (const disposable of disposables) {
    try {
      disposable[Symbol.dispose]();
    } catch (err) {
      if (isAbortError(err)) continue;
      errors.push(castToError(err));
    }
  }

  if (errors.length > 0) {
    throw new AggregateError(errors, 'One or more errors occurred during disposal.');
  }
}
