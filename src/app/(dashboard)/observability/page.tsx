'use client'

import { useEffect, useState, useCallback } from 'react'
import { Activity, RefreshCw, Loader2, CheckCircle, XCircle, Clock } from 'lucide-react'
import { ALL_TOPICS } from '@/lib/kafka/topics'

interface KafkaEvent {
  id: string
  topic: string
  source: string
  processed: boolean
  error?: string
  createdAt: string
  processedAt?: string
  payload: Record<string, unknown>
}

interface TopicStat {
  topic: string
  _count: { id: number }
}

const TOPIC_COLORS: Record<string, string> = {
  'obs.': 'bg-blue-500',
  'incident.': 'bg-red-500',
  'code.': 'bg-purple-500',
  'heal.': 'bg-green-500',
  'cloud.': 'bg-orange-500',
  'token.': 'bg-yellow-500',
}

function topicColor(topic: string) {
  for (const [prefix, color] of Object.entries(TOPIC_COLORS)) {
    if (topic.startsWith(prefix)) return color
  }
  return 'bg-slate-500'
}

function timeSince(dateStr: string) {
  const secs = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (secs < 60) return `${secs}s ago`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  return `${Math.floor(secs / 3600)}h ago`
}

export default function ObservabilityPage() {
  const [events, setEvents] = useState<KafkaEvent[]>([])
  const [stats, setStats] = useState<TopicStat[]>([])
  const [loading, setLoading] = useState(true)
  const [topicFilter, setTopicFilter] = useState<string>('')
  const [selected, setSelected] = useState<KafkaEvent | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(false)

  const fetchData = useCallback(async () => {
    const params = new URLSearchParams({ limit: '100' })
    if (topicFilter) params.set('topic', topicFilter)
    const res = await fetch(`/api/events?${params}`)
    if (res.ok) {
      const data = await res.json()
      setEvents(data.events)
      setStats(data.stats)
    }
    setLoading(false)
  }, [topicFilter])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(fetchData, 5000)
    return () => clearInterval(interval)
  }, [autoRefresh, fetchData])

  const processed = events.filter(e => e.processed).length
  const failed = events.filter(e => e.error).length
  const pending = events.filter(e => !e.processed).length

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Observability</h1>
          <p className="text-sm text-muted-foreground mt-1">Kafka event stream and topic statistics</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh(a => !a)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-colors ${autoRefresh ? 'bg-green-100 border-green-300 text-green-700 dark:bg-green-900/30 dark:border-green-700 dark:text-green-400' : 'hover:bg-muted'}`}
          >
            <Activity className="w-4 h-4" />
            {autoRefresh ? 'Live' : 'Auto-refresh'}
          </button>
          <button onClick={fetchData} className="flex items-center gap-2 border px-3 py-2 rounded-lg text-sm hover:bg-muted">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total Events', value: events.length, color: 'text-foreground' },
          { label: 'Processed', value: processed, color: 'text-green-500' },
          { label: 'Pending', value: pending, color: 'text-yellow-500' },
          { label: 'Errors', value: failed, color: 'text-red-500' },
        ].map(({ label, value, color }) => (
          <div key={label} className="border rounded-xl p-4 bg-card">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className={`text-2xl font-bold mt-1 ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Topic stats */}
        <div className="col-span-1">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Topics</h2>
          <div className="space-y-1.5">
            <button
              onClick={() => setTopicFilter('')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm ${!topicFilter ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}
            >
              <span>All topics</span>
              <span className="text-xs text-muted-foreground">{events.length}</span>
            </button>
            {stats.map(s => (
              <button
                key={s.topic}
                onClick={() => setTopicFilter(t => t === s.topic ? '' : s.topic)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${topicFilter === s.topic ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${topicColor(s.topic)}`} />
                <span className="flex-1 text-left truncate">{s.topic}</span>
                <span className="text-xs text-muted-foreground">{s._count.id}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Event stream */}
        <div className="col-span-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Event Stream {topicFilter && <span className="text-primary">· {topicFilter}</span>}
          </h2>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : events.length === 0 ? (
            <div className="border border-dashed rounded-xl p-8 text-center text-muted-foreground">
              <Activity className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>No events yet — events appear here as they flow through the system</p>
            </div>
          ) : (
            <div className="border rounded-xl overflow-hidden">
              <div className="divide-y max-h-[600px] overflow-y-auto">
                {events.map(event => (
                  <div
                    key={event.id}
                    onClick={() => setSelected(selected?.id === event.id ? null : event)}
                    className={`flex items-start gap-3 px-4 py-2.5 cursor-pointer hover:bg-muted/50 text-sm ${selected?.id === event.id ? 'bg-muted/50' : ''}`}
                  >
                    <div className="shrink-0 mt-0.5">
                      {event.error
                        ? <XCircle className="w-4 h-4 text-red-500" />
                        : event.processed
                          ? <CheckCircle className="w-4 h-4 text-green-500" />
                          : <Clock className="w-4 h-4 text-yellow-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${topicColor(event.topic)}`} />
                        <span className="font-mono text-xs text-muted-foreground truncate">{event.topic}</span>
                      </div>
                      <div className="truncate text-xs mt-0.5">
                        {(event.payload as any)?.message ?? (event.payload as any)?.title ?? event.source}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{timeSince(event.createdAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Payload inspector */}
          {selected && (
            <div className="mt-3 border rounded-xl p-4 bg-muted/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payload</span>
                <button onClick={() => setSelected(null)} className="text-xs text-muted-foreground hover:text-foreground">close</button>
              </div>
              <pre className="text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all">
                {JSON.stringify(selected.payload, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
