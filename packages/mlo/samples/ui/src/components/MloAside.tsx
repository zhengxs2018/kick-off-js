import type { MloStatsItem } from '@zhengxs/mlo'
import React from 'react'

import { fmtTime } from '../shared/util.js'
import { MloStatsCard } from './MloStatsCard.js'

export interface MloAsideProps {
  stats: MloStatsItem[]
  timestamp: number
}

export const MloAside: React.FC<MloAsideProps> = ({ stats, timestamp }) => {
  return (
    <aside className="w-64 flex-shrink-0 bg-white border border-gray-200 rounded-lg p-4 flex flex-col gap-3 overflow-y-auto shadow-sm">
      <h2 className="text-base font-semibold border-b-2 border-gray-100 pb-1.5 mb-1 text-gray-800">
        Memory Stats
      </h2>

      {stats.map((item) => (
        <MloStatsCard key={item.type} item={item} />
      ))}

      <div className="mt-auto bg-gray-50 p-3 rounded border border-gray-100">
        <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">
          Snapshot Time
        </h3>
        <div className="flex justify-between items-center mb-1">
          <span className="text-gray-600">Timestamp</span>
          <span className="font-mono text-xs text-gray-900">{timestamp}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Local</span>
          <span className="font-mono text-xs text-gray-900">
            {fmtTime(timestamp)}
          </span>
        </div>
      </div>
    </aside>
  )
}
