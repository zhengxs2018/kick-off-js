import React from 'react'
import type { MloObject } from '@zhengxs/mlo'
import { fmtTime } from '../shared/util.js'

export interface MloItemDetailsProps {
  item: MloObject | null | undefined
}

export const MloItemDetails: React.FC<MloItemDetailsProps> = ({ item }) => {
  if (!item) {
    return (
      <div className="h-0 border-t border-gray-200 bg-gray-50 transition-all duration-200 ease-out overflow-hidden" />
    )
  }

  return (
    <div className="mt-2 border-t border-gray-200 bg-gray-50 transition-all duration-200 ease-out overflow-hidden h-[200px]">
      <div className="h-full overflow-y-auto p-4 font-mono text-xs text-gray-700 custom-scrollbar">
        <div className="space-y-3">
          <div className="text-blue-700">
            <strong>Meta:</strong> {item.meta.className}
            {item.meta.extends.length > 0 && (
              <span> extends [{item.meta.extends.join(', ')}]</span>
            )}
          </div>

          <div>
            <strong>Labels:</strong>
            {item.labels.length === 0 ? (
              <span className="text-gray-400"> None</span>
            ) : (
              item.labels.map((label) => (
                <span
                  key={label}
                  className="inline-block px-1.5 py-0.5 mr-1 rounded bg-gray-200 text-gray-600 text-[10px]"
                >
                  {label}
                </span>
              ))
            )}
          </div>

          <div className="text-gray-500">
            Created: {fmtTime(item.createdAt)} | Observed:{' '}
            {String(item.observed)}
          </div>

          {item.stacks && item.stacks.length > 0 && (
            <div className="mt-2">
              <strong className="block mb-1 text-gray-900">
                Stack Traces:
              </strong>
              {item.stacks.map((stack, idx) => (
                <div key={idx} className="mb-2 pl-2 border-l-2 border-gray-300">
                  <div className="text-gray-500 mb-0.5">
                    #{idx} {stack.type || 'Anonymous'} @ {fmtTime(stack.at)}
                  </div>
                  <pre className="whitespace-pre-wrap text-red-600/80">
                    {stack.stack}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
