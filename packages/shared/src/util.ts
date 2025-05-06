export function arrayify<T>(arr: T | T[]): T[] {
  return isNil(arr) ? [] : Array.isArray(arr) ? arr : [arr]
}

export function isNil(value: unknown): value is null | undefined {
  return value === undefined || value === null
}
