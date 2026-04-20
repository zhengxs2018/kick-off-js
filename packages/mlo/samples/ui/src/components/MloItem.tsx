import React from 'react'
import type { MloObject } from '@zhengxs/mlo'

const BADGE_COLORS: Record<string, string> = {
  Element: 'bg-blue-100 text-blue-700',
  Component: 'bg-purple-100 text-purple-700',
  Object: 'bg-amber-100 text-amber-700',
  Function: 'bg-green-100 text-green-700',
  Event: 'bg-cyan-100 text-cyan-700',
  Timer: 'bg-pink-100 text-pink-700',
  Observer: 'bg-slate-100 text-slate-700',
}

export interface MloItemProps {
  item: MloObject
  selectedId: number | null | undefined
  onSelect(item: MloObject): void
}

export const MloItem: React.FC<MloItemProps> = ({
  item,
  selectedId,
  onSelect,
}) => {
  const isSelected = item.id === selectedId

  const badgeClass = BADGE_COLORS[item.type] || BADGE_COLORS['Object']

  const statusBadge = item.collected
    ? 'bg-gray-100 text-gray-400 line-through'
    : item.detached
    ? 'bg-red-50 text-red-600'
    : 'bg-green-50 text-green-600'

  const statusText = item.collected
    ? 'Collected'
    : item.detached
    ? 'Detached'
    : 'Active'

  return (
    <div
      key={item.id}
      onClick={() => onSelect(item)}
      className={`
        grid grid-cols-[60px_1fr_100px_100px_80px] gap-2.5 px-4 py-2 border-b border-gray-100
        cursor-pointer transition-colors duration-150 hover:bg-blue-50
        ${isSelected ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}
      `}
    >
      <span className="text-gray-400 font-mono text-xs">#{item.id}</span>

      <div className="flex items-center gap-2 truncate">
        <strong
          className={`truncate ${
            item.name === 'unknown' ? 'italic text-gray-400' : ''
          }`}
        >
          {item.name === 'unknown' ? item.type : item.name}
        </strong>
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${badgeClass}`}
        >
          {item.type}
        </span>
      </div>

      <span className="text-gray-600 capitalize">{item.category}</span>

      <span>
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${statusBadge}`}
        >
          {statusText}
        </span>
      </span>

      <span className="font-mono text-xs text-gray-500">
        {item.links.length > 0 ? item.links.join(',') : '-'}
      </span>
    </div>
  )
}
