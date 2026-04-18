import type { DisposeLike } from './event.js'

export type MloSetupContext = {
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
