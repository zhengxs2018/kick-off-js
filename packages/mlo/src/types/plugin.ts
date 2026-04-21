import type { DisposeLike } from '../base/common/events.js'
import type { MloEvents } from './mlo.js'

export type MloSetupContext = {
  events: MloEvents
  subscriptions: Array<DisposeLike | (() => void)>
}

export type MloPluginObject = {
  name: string
  setup: (context: MloSetupContext) => void
}

export type MloPluginFunction<T> = (options: T) => MloPluginObject

export type MloPlugin<T = object> = MloPluginObject | MloPluginFunction<T>

export type MloExtractPluginOptions<P> = P extends MloPluginFunction<infer T>
  ? T
  : object
