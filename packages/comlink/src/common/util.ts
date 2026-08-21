export function isObject<T extends object = Record<PropertyKey, unknown>>(
  value: unknown,
): value is T {
  return typeof value === 'object' && value !== null;
}

export function isAbortError(err: unknown): boolean {
  return isObject<Error>(err) && err.name === 'AbortError';
}

export function castToError(value: unknown): Error {
  if (value instanceof Error) return value;
  if (typeof value === 'string') return new Error(value);
  return new Error(String(value));
}

export function unref<T extends object>(ref: WeakRef<T> | null): T | undefined {
  if (ref === null) return undefined;

  const source = ref.deref();

  if (!source) {
    throw new DOMException('The target has been garbage collected', 'AbortError');
  }

  return source;
}

export function extractTransferables(value: unknown): Transferable[] {
  if (Array.isArray(value)) {
    return value.filter(isTransferable);
  }

  if (isTransferable(value)) {
    return [value];
  }

  return isObject(value) ? Object.values(value).filter(isTransferable) : [];
}

function isTransferable(v: unknown) {
  return (
    v instanceof ArrayBuffer ||
    v instanceof MessagePort ||
    v instanceof ReadableStream ||
    v instanceof WritableStream ||
    v instanceof TransformStream
  );
}
