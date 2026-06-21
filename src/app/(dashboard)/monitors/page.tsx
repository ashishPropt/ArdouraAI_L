'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Activity, Plus, RefreshCw, Loader2, Trash2, ToggleLeft, ToggleRight,
  CheckCircle2, XCircle, AlertCircle, Clock, ExternalLink, Globe
} from 'lucide-react'

interface MonitorCheck {
  id: string
  status: string
  statusCode: number | null
  responseMs: number | null
  error: string | null
  checkedAt: string
}

interface Monitor {
  id: string
  name: string
  url: string
  method: string
  expectedStatus: number
  intervalSecs: number
  timeoutSecs: number
  active: boolean
  lastStatus: string | null
  lastCheckedAt: string | null
  projectId: string
  checks: MonitorCheck[]
  _count: { incidents: number }
}

interface Project { id: string; name: string }

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  UP:       { label: 'Up',       color: 'text-green-400',  icon: <CheckCircle2 className="w-4 h-4 text-green-400" /> },
  DOWN:     { label: 'Down',     color: 'text-red-400',    icon: <XCircle className="w-4 h-4 text-red-400" /> },
  DEGRADED: { label: 'Degraded', color: 'text-yellow-400', icon: <AlertCircle className="w-4 h-4 text-yellow-400" /> },
  TIMEOUT:  { label: 'Timeout',  color: 'text-orange-400', icon: <Clock className="w-4 h-4 text-orange-400" /> },
}

function StatusDot({ status }: { status: string | null }) {
  if (!status) return <span className="w-2 h-2 rounded-full bg-slate-600 inline-block" />
  const colors: Record<string, string> = {
    UP: 'bg-green-400', DOWN: 'bg-red-500 animate-pulse',
    DEGRADED: 'bg-yellow-400', TIMEOUT: 'bg-orange-400',
  }
  return <span className={`w-2 h-2 rounded-full inline-block ${colors[status] ?? 'bg-slate-600'}`} />
}

function MiniSparkline({ checks }: { checks: MonitorCheck[] }) {
  const recent = [...checks].reverse().slice(-30)
  if (recent.length === 0) return <span className="text-xs text-muted-foreground">No data</span>
  return (
    <div className="flex items-end gap-0.5 h-6">
      {recent.map((c, i) => (
        <div
          key={i}
          title={`${c.status} ${c.responseMs ? c.responseMs + 'ms' : ''} — ${new Date(c.checkedAt).toLocaleTimeString()}`}
          className={`w-1.5 rounded-sm flex-shrink-0 ${
            c.status === 'UP' ? 'bg-green-500' :
            c.status === 'DOWN' ? 'bg-red-500' :
            c.status === 'TIMEOUT' ? 'bg-orange-400' : 'bg-yellow-400'
          }`}
          style={{ height: `${Math.max(20, Math.min(100, ((c.responseMs ?? 200) / 2000) * 100))}%` }}
        />
      ))}
    </div>
  )
}

export default function MonitorsPage() {
  const [monitors, setMonitors] = useState<Monitor[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)
  const [form, setForm] = useState({
    projectId: '', name: '', url: '', method: 'GET',
    expectedStatus: '200', intervalSecs: '60', timeoutSecs: '10',
  })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [mRes, pRes] = await Promise.all([
      fetch('/api/monitors'),
      fetch('/api/projects'),
    ])
    if (mRes.ok) setMonitors((await mRes.json()).monitors)
    if (pRes.ok) setProjects((await pRes.json()).projects ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function addMonitor() {
    if (!form.projectId || !form.name || !form.url) { setFormError('All required fields must be filled'); return }
    setSaving(true); setFormError('')
    const res = await fetch('/api/monitors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        expectedStatus: parseInt(form.expectedStatus),
        intervalSecs: parseInt(form.intervalSecs),
        timeoutSecs: parseInt(form.timeoutSecs),
      }),
    })
    if (res.ok) { setShowAdd(false); setForm({ projectId: '', name: '', url: '', method: 'GET', expectedStatus: '200', intervalSecs: '60', timeoutSecs: '10' }); await load() }
    else { const d = await res.json(); setFormError(d.error ?? 'Failed') }
    setSaving(false)
  }

  async function deleteMonitor(id: string) {
    setDeleting(id)
    await fetch(`/api/monitors/${id}`, { method: 'DELETE' })
    setMonitors(prev => prev.filter(m => m.id !== id))
    setDeleting(null)
  }

  async function toggleMonitor(m: Monitor) {
    setToggling(m.id)
    await fetch(`/api/monitors/${m.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !m.active }),
    })
    setMonitors(prev => prev.map(x => x.id === m.id ? { ...x, active: !x.active } : x))
    setToggling(null)
  }

  const upCount = monitors.filter(m => m.lastStatus === 'UP').length
  const downCount = monitors.filter(m => m.lastStatus === 'DOWN').length
  const unknownCount = monitors.filter(m => !m.lastStatus).length

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="w-6 h-6 text-ardoura-400" /> Uptime Monitors
          </h1>
          <p className="text-sm text-muted-foreground mt-1">HTTP health checks for your deployed apps</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="border px-3 py-2 rounded-lg text-sm hover:bg-muted">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 bg-ardoura-600 hover:bg-ardoura-500 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Add Monitor
          </button>
        </div>
      </div>

      {/* Summary bar */}
      {monitors.length > 0 && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total', value: monitors.length, color: 'text-foreground' },
            { label: 'Up', value: upCount, color: 'text-green-500' },
            { label: 'Down', value: downCount, color: 'text-red-500' },
            { label: 'Unknown', value: unknownCount, color: 'text-muted-foreground' },
          ].map(({ label, value, color }) => (
            <div key={label} className="border rounded-xl p-4 bg-card">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : monitors.length === 0 ? (
        <div className="border border-dashed rounded-2xl p-12 text-center">
          <Globe className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" />
          <p className="font-medium text-muted-foreground">No monitors yet</p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">Add a URL to start monitoring uptime</p>
          <button onClick={() => setShowAdd(true)} className="bg-ardoura-600 hover:bg-ardoura-500 text-white px-5 py-2 rounded-lg text-sm font-medium">
            Add your first monitor
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {monitors.map(m => {
            const cfg = m.lastStatus ? STATUS_CONFIG[m.lastStatus] : null
            const upChecks = m.checks.filter(c => c.status === 'UP').length
            const uptimePct = m.checks.length > 0 ? ((upChecks / m.checks.length) * 100).toFixed(1) : null
            const avgMs = m.checks.filter(c => c.responseMs).length > 0
              ? Math.round(m.checks.filter(c => c.responseMs).reduce((s, c) => s + (c.responseMs ?? 0), 0) / m.checks.filter(c => c.responseMs).length)
              : null
            return (
              <div key={m.id} className={`border rounded-xl p-4 bg-card transition-opacity ${!m.active ? 'opacity-50' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <StatusDot status={m.lastStatus} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{m.name}</span>
                        {cfg && <span className={`text-xs ${cfg.color} flex items-center gap-1`}>{cfg.icon}{cfg.label}</span>}
                        {!m.active && <span className="text-xs text-muted-foreground border rounded px-1.5 py-0.5">Paused</span>}
                      </div>
                      <a
                        href={m.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mt-0.5 w-fit"
                      >
                        {m.url} <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 flex-shrink-0 text-xs text-muted-foreground">
                    {uptimePct && <span className="font-medium text-foreground">{uptimePct}% up</span>}
                    {avgMs && <span>{avgMs}ms avg</span>}
                    <span>every {m.intervalSecs}s</span>
                    {m._count.incidents > 0 && (
                      <span className="text-red-400">{m._count.incidents} incident{m._count.incidents !== 1 ? 's' : ''}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => toggleMonitor(m)}
                      disabled={toggling === m.id}
                      title={m.active ? 'Pause' : 'Resume'}
                      className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                    >
                      {toggling === m.id ? <Loader2 className="w-4 h-4 animate-spin" /> : m.active ? <ToggleRight className="w-4 h-4 text-green-400" /> : <ToggleLeft className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => deleteMonitor(m.id)}
                      disabled={deleting === m.id}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
                    >
                      {deleting === m.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {m.checks.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border/50">
                    <MiniSparkline checks={m.checks} />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Last {m.checks.length} checks · Last seen {m.lastCheckedAt ? new Date(m.lastCheckedAt).toLocaleTimeString() : 'never'}
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add Monitor Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-background border rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4">Add Monitor</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Project <span className="text-red-400">*</span></label>
                <select value={form.projectId} onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm bg-background">
                  <option value="">Select a project…</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Name <span className="text-red-400">*</span></label>
                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm bg-background" placeholder="Production API" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">URL <span className="text-red-400">*</span></label>
                <input type="url" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm bg-background" placeholder="https://api.example.com/health" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Method</label>
                  <select value={form.method} onChange={e => setForm(f => ({ ...f, method: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm bg-background">
                    {['GET','HEAD','POST'].map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Expected</label>
                  <input type="number" value={form.expectedStatus} onChange={e => setForm(f => ({ ...f, expectedStatus: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Interval (s)</label>
                  <input type="number" value={form.intervalSecs} onChange={e => setForm(f => ({ ...f, intervalSecs: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
                </div>
              </div>
              {formError && <p className="text-red-400 text-sm">{formError}</p>}
              <div className="flex gap-3 pt-2">
                <button onClick={addMonitor} disabled={saving} className="flex-1 bg-ardoura-600 hover:bg-ardoura-500 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add Monitor'}
                </button>
                <button onClick={() => { setShowAdd(false); setFormError('') }} className="flex-1 border py-2 rounded-lg text-sm hover:bg-muted">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
