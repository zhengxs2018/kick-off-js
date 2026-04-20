import type { MloObject, MloStatsItem } from '@zhengxs/mlo'
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { MloAside } from './components/MloAside.js'
import { MloList } from './components/MloList.js'
import { MloItemDetails } from './components/MloItemDetails.js'

import { mlo } from '@zhengxs/mlo'

export default function App() {
  const [isProcessing, setIsProcessing] = useState<boolean>(false)

  const [data, setData] = useState({
    timestamp: 0,
    stats: [] as MloStatsItem[],
    items: [] as MloObject[],
  })

  const [selectedId, setSelectedId] = useState<number | null>()

  const selectedItem = useMemo(() => {
    return selectedId
      ? data.items.find((item) => item.id === selectedId)
      : undefined
  }, [data.items, selectedId])

  const fetchData = useCallback(() => {
    const raw = mlo.toJSON()

    setData({
      timestamp: raw.timestamp,
      items: raw.items,
      stats: Object.values(raw.stats),
    })

    setIsProcessing(false)
  }, [])

  useEffect(() => {
    const { items } = data

    if (items.length === 0) {
      setSelectedId(null)
      return
    }

    const exists = selectedId ? items.some((i) => i.id === selectedId) : null
    if (exists) return

    setSelectedId(items[0].id)
  }, [data.items, selectedId])

  useEffect(() => {
    fetchData()

    const timerId = window.setInterval(() => {
      if (isProcessing) return
      setIsProcessing(true)
      requestIdleCallback(fetchData)
    }, 2000)

    return () => {
      clearInterval(timerId)
    }
  }, [fetchData])

  function handleSelect(item: MloObject) {
    setSelectedId(item.id)
  }

  return (
    <div className="flex w-screen h-screen p-2.5 gap-2.5 bg-gray-100 font-sans text-sm text-gray-800 overflow-hidden">
      <MloAside stats={data.stats} timestamp={data.timestamp} />

      <div className="flex-1 flex flex-col min-w-0">
        <MloList
          items={data.items}
          selectedId={selectedId}
          onSelect={handleSelect}
        />
        <MloItemDetails item={selectedItem} />
      </div>
    </div>
  )
}
