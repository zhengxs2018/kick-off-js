import type { DisposeLike } from './event.js'

export type RuleMatchType = 'exact' | 'contains' | 'regex' | 'starts' | 'ends'

export interface RuleBase {
  type: RuleMatchType
  test: string | RegExp
  reason: string
}

export interface StringRule extends RuleBase {
  type: Exclude<RuleMatchType, 'regex'>
  test: string
}

export interface RegExpRule extends RuleBase {
  type: 'regex'
  test: RegExp
}

export type Rule = StringRule | RegExpRule

export type MatchResult = {
  ok: boolean
  reason?: string
}

export interface Matcher<T> extends DisposeLike {
  match(data: T): MatchResult
}
