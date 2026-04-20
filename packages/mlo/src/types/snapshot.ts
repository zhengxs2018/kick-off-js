import type { MloObject } from './object.js'

export interface MloData {
  stats: MloStats
  items: MloObject[]
  timestamp: number
}

export type MloStatsItem = {
  type: string
  total: number
  detached: number
  details: MloStatsSubItem[]
}

export type MloStatsSubItem = {
  label: string
  count: number
  detached: number
}

export type MloStats = Record<string, MloStatsItem>
