import type { DisposeLike } from './events.js'

export type MatcherOptions = {
  rules: Rule[]
  exclude?: boolean
}

export function createMatcher<T>(
  { rules, exclude }: MatcherOptions,
  predicate: (data: T, check: (part: string) => boolean) => boolean
): Matcher<T> {
  const exactMap = new Map<string, MatchResult>()

  const executors: RuleExecutor[] = []

  for (const r of rules) {
    addRule(r)
  }

  return {
    match(data: T): MatchResult {
      let result: MatchResult | undefined

      if (predicate(data, check) && result) {
        return result
      }

      return { ok: true }

      function check(part: string): boolean {
        if (!part) return false

        if (exactMap.has(part)) {
          result = exactMap.get(part)!
          return true
        }

        let idx = executors.length

        while (idx--) {
          const item = executors[idx]

          if (item.exec(part)) {
            result = { ok: exclude !== true, reason: item.reason }
            return true
          }
        }

        return false
      }
    },
    dispose() {
      exactMap.clear()
      executors.length = 0
    },
  }

  function addRule(rule: Rule) {
    switch (rule.type) {
      case 'exact':
        exactMap.set(rule.test, { reason: rule.reason, ok: exclude !== true })
        break
      case 'starts':
        executors.push({
          exec: (s) => s.startsWith(rule.test),
          reason: rule.reason,
        })
        break
      case 'ends':
        executors.push({
          exec: (s) => s.endsWith(rule.test),
          reason: rule.reason,
        })
        break
      case 'contains':
        executors.push({
          exec: (s) => s.includes(rule.test),
          reason: rule.reason,
        })
        break
      case 'regex':
        const re = rule.test.global
          ? new RegExp(rule.test.source, rule.test.flags.replace('g', ''))
          : rule.test
        executors.push({
          exec: (s) => re.test(s),
          reason: rule.reason
        })
        break
    }
  }
}

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

export type RuleExecutor = {
  exec: (source: string) => boolean
  reason: string
}
