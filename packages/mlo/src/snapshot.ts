import { ObjectRefs } from "./base/internal/store.js"
import type { MloObject } from "./types/object.js"
import type { MloRef } from "./types/ref.js"
import type { MloSnapshot, MloStats, MloStatsSubItem } from "./types/snapshot.js"

export function snapshot(): MloSnapshot {
  const items: MloObject[] = []
  const stats: MloStats = {}

  const categories: Record<string, Record<string, MloStatsSubItem>> = {}

  for (const ref of new Set(ObjectRefs.values())) {
    const source = ref.deref()
    if (!source) {
      ref.dispose()
      continue
    }

    items.push(ref.toJSON())

    setStatsItem(ref)
    setStatsDetail(ref)
  }

  Object.keys(categories).forEach((type) => {
    const item = stats[type]
    if (item) item.details = Object.values(categories[type])
  })

  return {
    stats: Object.values(stats),
    items,
    timestamp: Date.now(),
  }

  function setStatsDetail({ type, category, detached }: MloRef) {
    const details = categories[category]

    if (!details) {
      categories[category] = {
        [type]: { label: type, count: 1, detached: detached ? 1 : 0 },
      }
      return
    }

    const item = details[type]

    if (item) {
      item.count++
      if (detached) item.detached++
    } else {
      details[type] = { label: type, count: 1, detached: detached ? 1 : 0 }
    }
  }

  function setStatsItem({ category, detached }: MloRef) {
    let item = stats[category]

    if (item) {
      item.total++

      if (detached) item.detached++
    } else {
      item = { type: category, total: 1, detached: detached ? 1 : 0, details: [] }
      stats[category] = item
    }

  }
}
