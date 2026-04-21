import type { MloStatsItem } from '@zhengxs/mlo'
import React from 'react'
import { AlertCircle, Box, Cpu } from 'lucide-react'

import { cn } from '@/lib/utils'

export type MloStatsCardProps = {
  title: string
  stat: MloStatsItem
  onClick?: (type: string) => void
}

export const MloStatsCard: React.FC<MloStatsCardProps> = ({
  title,
  stat,
  onClick,
}) => {
  const isCritical = stat.detached > 0

  return (
    // 关键修改：添加 min-w-[280px] 和 shrink-0，防止在 flex 布局中被压缩
    <div
      onClick={() => onClick?.(stat.type)}
      className={cn(
        'group relative overflow-hidden rounded-2xl border bg-white p-6 shadow-sm transition-all hover:shadow-md cursor-pointer shrink-0 min-w-[280px] sm:min-w-0',
        // sm:min-w-0 允许在大屏 grid 模式下自适应宽度
        isCritical ? 'border-red-100' : 'border-zinc-200'
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-500">{title}</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-zinc-900">
              {stat.total}
            </span>
            <span className="text-sm text-zinc-500">Total</span>
          </div>
          {stat.detached > 0 && (
            <div className="mt-1 flex items-center gap-1 text-xs font-medium text-red-600">
              <AlertCircle size={12} />
              <span>{stat.detached} Detached</span>
            </div>
          )}
        </div>
        <div
          className={cn(
            'flex h-12 w-12 items-center justify-center rounded-xl',
            isCritical ? 'bg-red-50 text-red-600' : 'bg-zinc-50 text-zinc-600'
          )}
        >
          {title.toLowerCase().includes('element') ? (
            <Box size={24} />
          ) : (
            <Cpu size={24} />
          )}
        </div>
      </div>

      {/* Details Breakdown */}
      <div className="mt-4 flex flex-wrap gap-2">
        {stat.details.slice(0, 3).map((detail, idx) => (
          <span
            key={idx}
            className="inline-flex items-center rounded-md bg-zinc-50 px-2 py-1 text-xs font-medium text-zinc-600 ring-1 ring-inset ring-zinc-500/10"
          >
            {detail.label}{' '}
            <span className="ml-1 text-zinc-400">({detail.count})</span>
          </span>
        ))}
        {stat.details.length > 3 && (
          <span className="inline-flex items-center rounded-md bg-zinc-50 px-2 py-1 text-xs font-medium text-zinc-400">
            +{stat.details.length - 3}
          </span>
        )}
      </div>
    </div>
  )
}
