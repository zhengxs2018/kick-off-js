export function arrayify<T>(arr: T | T[]): T[] {
  return isNil(arr) ? [] : Array.isArray(arr) ? arr : [arr]
}

export function isNil(value: unknown): value is null | undefined {
  return value === undefined || value === null
}

const hasOwnProperty = Object.prototype.hasOwnProperty

export function hasOwn<T extends object, K extends PropertyKey = PropertyKey>(
  o: unknown,
  prop: K
): o is T & Record<K, unknown> {
  return isNil(o) == false && hasOwnProperty.call(o, prop)
}
