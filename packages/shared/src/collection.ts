import { isNil } from './util.js'

export function arrayify<T>(arr: T | T[] | null | undefined): T[] {
  return isNil(arr) ? [] : Array.isArray(arr) ? arr : [arr]
}
