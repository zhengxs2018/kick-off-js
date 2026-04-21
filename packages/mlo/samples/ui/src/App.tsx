import {
  isMloMessageEvent,
  type MloObject,
  type MloSnapshot,
} from '@zhengxs/mlo'
import React, { useState, useMemo, useEffect } from 'react'
import { Search, AlertCircle, Box } from 'lucide-react'
import { cn, formatTime } from './lib/utils'

import { MloStatsCard } from './components/mlo/MloStatsCard.js'
import { MloLinkDialog } from './components/mlo/MloLinkDialog.js'
import { MloTable } from './components/mlo/MloTable.js'

export default function App() {
  const [isProcessing, setIsProcessing] = useState<boolean>(false)

  const [categories, setCategories] = useState<string[]>(['all'])

  const [data, setData] = useState<MloSnapshot>({
    timestamp: 0,
    stats: [],
    items: [],
  })

  const [searchQuery, setSearchQuery] = useState('')
  const [showOnlyDetached, setShowOnlyDetached] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogLinks, setDialogLinks] = useState<number[]>([])
  const [dialogTitle, setDialogTitle] = useState('')

  const filteredItems = useMemo(() => {
    return data.items.filter((item) => {
      const matchesSearch = searchQuery
        ? item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.id.toString().includes(searchQuery)
        : true

      const matchesCategory =
        selectedCategory === 'all' || item.category === selectedCategory
      const matchesDetached = !showOnlyDetached || item.detached

      return matchesSearch && matchesCategory && matchesDetached
    })
  }, [data, searchQuery, selectedCategory, showOnlyDetached])

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (isProcessing || !isMloMessageEvent(event)) return
      setIsProcessing(true)

      const { data: message } = event
      if (message.type === 'snapshot') {
        const data = message.data

        setData(data)
        setCategories(['all', ...data.stats.map((s) => s.type)])
        setIsProcessing(false)
      }
    }

    window.addEventListener('message', handleMessage, true)

    return () => {
      window.removeEventListener('message', handleMessage)
    }
  }, [])

  function handleLinkClick(links: number[], title: string) {
    setDialogLinks(links)
    setDialogTitle(title)
    setDialogOpen(true)
  }

  function handleLog(item: MloObject) {
    console.log('Mlo Object:', item)
  }

  return (
    <div className="min-h-screen bg-zinc-50/50 font-sans text-zinc-900 selection:bg-blue-100">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-zinc-200/60 bg-white/80 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
                <Box size={24} />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-zinc-900">
                  Memory Leak Observer
                </h1>
                <p className="text-xs text-zinc-500">
                  Snapshot: {formatTime(data.timestamp)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-2 text-sm text-zinc-500">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Live Monitoring
              </div>
              <button className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 transition-colors">
                Export Report
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8 space-y-8">
        {/* Stats Section */}
        <section className="relative">
          <div className="flex gap-6 overflow-x-auto pb-4 snap-x snap-mandatory md:grid md:grid-cols-2 md:overflow-visible md:snap-none xl:grid-cols-4">
            {data.stats.map((stat) => (
              <div key={stat.type} className="snap-center">
                <MloStatsCard
                  title={stat.type.toUpperCase()}
                  stat={stat}
                  onClick={setSelectedCategory}
                />
              </div>
            ))}
            <div className="pointer-events-none absolute right-0 top-0 bottom-4 w-16 bg-gradient-to-l from-zinc-50/50 to-transparent md:hidden" />
          </div>
        </section>

        {/* Toolbar */}
        <section className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Search by ID, Name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 pl-10 pr-4 text-sm outline-none ring-blue-500/20 focus:border-blue-500 focus:bg-white focus:ring-4 transition-all"
            />
          </div>

          <div className="flex items-center gap-3 overflow-x-auto pb-2 md:pb-0">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-blue-500"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === 'all' ? 'All Categories' : cat}
                </option>
              ))}
            </select>

            <button
              onClick={() => setShowOnlyDetached(!showOnlyDetached)}
              className={cn(
                'flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-all',
                showOnlyDetached
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
              )}
            >
              <AlertCircle size={16} />
              Only Detached
            </button>
          </div>
        </section>

        {/* Data Table */}
        <MloTable
          data={filteredItems}
          onLink={handleLinkClick}
          onLog={handleLog}
        />
      </main>

      {/* Dialog */}
      <MloLinkDialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        links={dialogLinks}
        allItems={data.items}
        title={dialogTitle}
      />
    </div>
  )
}
