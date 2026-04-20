import React from 'react'
import type { MloObject } from '@zhengxs/mlo'

import { MloItem } from './MloItem.js'

export interface MloListProps {
  items: MloObject[]
  selectedId: number | null | undefined
  onSelect: (item: MloObject) => void
}

export const MloList: React.FC<MloListProps> = ({
  items,
  selectedId,
  onSelect,
}) => {
  return (
    <div className="flex-1 bg-white border border-gray-200 rounded-lg flex flex-col overflow-hidden shadow-sm">
      <div className="grid grid-cols-[60px_1fr_100px_100px_80px] gap-2.5 px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 select-none">
        <span>ID</span>
        <span>Name / Type</span>
        <span>Category</span>
        <span>Status</span>
        <span>Links</span>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {items.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            No items captured yet.
          </div>
        ) : (
          items.map((item) => {
            return (
              <MloItem
                key={item.id}
                item={item}
                selectedId={selectedId}
                onSelect={onSelect}
              />
            )
          })
        )}
      </div>
    </div>
  )
}
