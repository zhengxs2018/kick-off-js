import type { Matcher, MatchResult, Rule } from '../../types/matcher.js'

const NO_MATCH: MatchResult = Object.freeze({ ok: false })

const MATCH_HIT = (reason: string): MatchResult => ({ ok: true, reason })

export function createMatcher<T>(
  rules: Rule[],
  predicate: (data: T, check: (part: string) => boolean) => boolean
): Matcher<T> {
  const exactMap = new Map<string, string>()

  const executors: RuleExecutor[] = []

  let currentReason: string | null = null

  for (const r of rules) {
    addRule(r)
  }

  return {
    match(data: T): MatchResult {
      currentReason = null

      if (predicate(data, check) && currentReason) {
        return MATCH_HIT(currentReason)
      }

      return NO_MATCH
    },
    dispose() {
      exactMap.clear()
      executors.length = 0
    },
  }

  function addRule(rule: Rule) {
    switch (rule.type) {
      case 'exact':
        exactMap.set(rule.test, rule.reason)
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
        executors.push({ exec: (s) => re.test(s), reason: rule.reason })
        break
    }
  }

  function check(part: string): boolean {
    if (!part) return false

    if (exactMap.has(part)) {
      currentReason = exactMap.get(part)!
      return true
    }

    let idx = executors.length

    while (idx--) {
      const item = executors[idx]

      if (item.exec(part)) {
        currentReason = item.reason
        return true
      }
    }

    return false
  }
}

type RuleExecutor = {
  exec: (source: string) => boolean
  reason: string
}
