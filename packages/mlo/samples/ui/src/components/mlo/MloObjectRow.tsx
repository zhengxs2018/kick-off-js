import type { MloObject } from '@zhengxs/mlo'
import React from 'react'
import { Terminal, Box, Cpu } from 'lucide-react'

import { MloBadge } from './MloBadge.js'
import { formatTime } from '@/lib/utils'

export type MloObjectRowProps = {
  item: MloObject
  onLink(links: number[], title: string): void
  onLog(item: MloObject): void
}

export const MloObjectRow: React.FC<MloObjectRowProps> = ({
  item,
  onLink,
  onLog,
}) => {
  // Determine status badge
  const statusBadge = item.detached ? (
    <MloBadge variant="destructive">Detached</MloBadge>
  ) : item.disposed ? (
    <MloBadge variant="secondary">Disposed</MloBadge>
  ) : (
    <MloBadge variant="success">Normal</MloBadge>
  )

  // Handle Links Display (+N logic)
  const maxVisibleLinks = 3
  const visibleLinks = item.links.slice(0, maxVisibleLinks)
  const remainingLinks = item.links.length - maxVisibleLinks

  return (
    <tr className="group border-b border-zinc-100 last:border-0 hover:bg-zinc-50/80 transition-colors">
      <td className="py-3 pl-4">
        <button
          onClick={() => onLog(item)} // Or filter by ID
          className="font-mono text-xs text-zinc-500 hover:text-blue-600 hover:underline"
        >
          #{item.id}
        </button>
      </td>
      <td className="py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500">
            {item.category === 'element' ? (
              <Box size={16} />
            ) : (
              <Cpu size={16} />
            )}
          </div>
          <div>
            <div className="font-medium text-zinc-900">{item.name}</div>
            <div className="text-xs text-zinc-500">{item.type}</div>
          </div>
        </div>
      </td>
      <td className="py-3">
        <MloBadge variant="outline" className="capitalize">
          {item.category}
        </MloBadge>
      </td>
      <td className="py-3">{statusBadge}</td>
      <td className="py-3 text-xs text-zinc-500 font-mono">
        {formatTime(item.createdAt)}
      </td>
      <td className="py-3">
        <div className="flex items-center gap-1">
          {visibleLinks.map((linkId) => (
            <button
              key={linkId}
              onClick={() => onLink([linkId], `Link #${linkId}`)}
              className="flex h-6 w-6 items-center justify-center rounded bg-blue-50 text-xs font-medium text-blue-600 hover:bg-blue-100"
            >
              {linkId}
            </button>
          ))}
          {remainingLinks > 0 && (
            <button
              onClick={() =>
                onLink(item.links, `All Links for #${item.id}`)
              }
              className="flex h-6 items-center rounded bg-zinc-100 px-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-200"
            >
              +{remainingLinks}
            </button>
          )}
        </div>
      </td>
      <td className="py-3 pr-4 text-right">
        <button
          onClick={() => onLog(item)}
          className="inline-flex items-center justify-center rounded-md p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900"
          title="Log to Console"
        >
          <Terminal size={16} />
        </button>
      </td>
    </tr>
  )
}
