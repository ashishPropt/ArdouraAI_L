'use client'

import { useEffect, useState, useCallback } from 'react'
import { Activity, Loader2, RefreshCw, Filter } from 'lucide-react'

interface Project { id: string; name: string }
interface ActivityEntry {
  id: string; action: string; entity?: string; entityId?: string
  metadata?: Record<string, unknown>; createdAt: string
  project?: { id: string; name: string }
}

const ACTION_ICONS: Record<string, string> = {
  'project.created':    '🗂',
  'workflow.created':   '⚡',
  'workflow.updated':   '✏️',
  'workflow.deleted':   '🗑',
  'workflow.run':       '▶',
  'file.edited':        '📝',
  'incident.created':   '🚨',
  'incident.resolved':  '✅',
  'heal.approved':      '🔧',
  'heal.rejected':      '❌',
}

const ACTION_COLOR: Record<string, string> = {
  'project.created':   'bg-blue-900/30 text-blue-300',
  'workflow.created':  'bg-violet-900/30 text-violet-300',
  'workflow.run':      'bg-green-900/30 text-green-300',
  'incident.created':  'bg-red-900/30 text-red-300',
  'incident.resolved': 'bg-green-900/30 text-green-300',
  'heal.approved':     'bg-orange-900/30 text-orange-300',
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return new Date(iso).toLocaleDateString()
}

export default function ActivityPage() {
  const [logs, setLogs] = useState<ActivityEntry[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [lRes, pRes] = await Promise.all([
      fetch(`/api/activity?limit=100${filter ? `&projectId=${filter}` : ''}`),
      fetch('/api/projects'),
    ])
    if (lRes.ok) setLogs(await lRes.json())
    if (pRes.ok) setProjects(await pRes.json())
    setLoading(false)
  }, [filter])

  useEffect(() => { load() }, [load])

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-white">
            <Activity className="w-6 h-6 text-ardoura-400" /> Activity
          </h1>
          <p className="text-sm text-slate-400 mt-1">Platform-wide audit log</p>
        </div>
        <div className="flex gap-2">
          <div className="flex items-center gap-2 border border-slate-700 rounded-lg px-3 py-2 text-sm bg-slate-800">
            <Filter className="w-4 h-4 text-slate-400" />
            <select value={filter} onChange={e => setFilter(e.target.value)} className="bg-transparent text-slate-300 text-sm outline-none">
              <option value="">All projects</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <button onClick={load} className="border border-slate-700 px-3 py-2 rounded-lg text-slate-400 hover:bg-slate-800 text-sm transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-slate-500" /></div>
      ) : logs.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          <Activity className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">No activity yet. Actions across the platform will appear here.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {logs.map(log => {
            const icon = ACTION_ICONS[log.action] ?? '•'
            const color = ACTION_COLOR[log.action] ?? 'bg-slate-800 text-slate-300'
            return (
              <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-800/50 transition-colors">
                <span className="text-lg w-6 text-center flex-shrink-0 mt-0.5">{icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded font-mono ${color}`}>{log.action}</span>
                    {log.project && (
                      <span className="text-xs text-slate-500">{log.project.name}</span>
                    )}
                    {log.entity && log.entityId && (
                      <span className="text-xs text-slate-600 font-mono">{log.entity} {log.entityId.slice(0, 8)}</span>
                    )}
                  </div>
                  {log.metadata && Object.keys(log.metadata).length > 0 && (
                    <p className="text-xs text-slate-500 mt-0.5 truncate font-mono">
                      {JSON.stringify(log.metadata).slice(0, 100)}
                    </p>
                  )}
                </div>
                <span className="text-xs text-slate-600 flex-shrink-0">{relativeTime(log.createdAt)}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
