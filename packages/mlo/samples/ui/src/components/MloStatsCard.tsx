import type { MloStatsItem } from '@zhengxs/mlo'
import React from 'react'

export interface MloStatsCardProps {
  item: MloStatsItem
}

export const MloStatsCard: React.FC<MloStatsCardProps> = ({ item }) => {
  return (
    <div
      key={item.type}
      className="bg-gray-50 p-3 rounded border border-gray-100"
    >
      <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">
        {item.type}
      </h3>
      <div className="flex justify-between items-center mb-1">
        <span className="text-gray-600">Total</span>
        <span className="font-mono font-bold text-gray-900">{item.total}</span>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-gray-600">Detached</span>
        <span
          className={`font-mono font-bold ${
            item.detached > 0 ? 'text-red-600' : 'text-gray-800'
          }`}
        >
          {item.detached}
        </span>
      </div>
    </div>
  )
}
