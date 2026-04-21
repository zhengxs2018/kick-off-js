import type { MloPluginObject } from '../../types/plugin.js'
import { isFunction, isObject } from '../common/utils.js'

export function isPluginObject(plugin: unknown): plugin is MloPluginObject {
  return isObject<MloPluginObject>(plugin) && isFunction(plugin.setup)
}
