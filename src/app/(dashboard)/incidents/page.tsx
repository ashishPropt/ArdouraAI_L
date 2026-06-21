'use client'

import { useEffect, useState, useCallback } from 'react'
import { AlertTriangle, CheckCircle, Clock, Loader2, ChevronDown, ChevronUp, ThumbsUp, ThumbsDown, RefreshCw } from 'lucide-react'

interface HealAction {
  id: string
  title: string
  status: string
  riskLevel: string
  description?: string
  fixType?: string
  createdAt?: string
}

interface Incident {
  id: string
  title: string
  severity: string
  status: string
  source: string
  externalRef?: string
  rootCause?: string
  startedAt: string
  resolvedAt?: string
  healActions: HealAction[]
}

const SEV_COLORS: Record<string, string> = {
  P1: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  P2: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  P3: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  P4: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  OPEN:          <AlertTriangle className="w-4 h-4 text-red-500" />,
  INVESTIGATING: <Clock className="w-4 h-4 text-yellow-500" />,
  RESOLVED:      <CheckCircle className="w-4 h-4 text-green-500" />,
}

const HEAL_STATUS_COLORS: Record<string, string> = {
  PENDING:   'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  APPROVED:  'bg-blue-100 text-blue-700',
  REJECTED:  'bg-red-100 text-red-700',
  EXECUTING: 'bg-purple-100 text-purple-700',
  APPLIED:   'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  FAILED:    'bg-red-100 text-red-700',
}

const RISK_COLORS: Record<string, string> = {
  LOW: 'text-green-500', MEDIUM: 'text-yellow-500', HIGH: 'text-orange-500', CRITICAL: 'text-red-500',
}

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [pendingActions, setPendingActions] = useState<HealAction[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [acting, setActing] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('OPEN')

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [incRes, healRes] = await Promise.all([
      fetch(`/api/incidents?status=${statusFilter}&limit=50`),
      fetch('/api/heal?status=PENDING'),
    ])
    if (incRes.ok) setIncidents((await incRes.json()).incidents)
    if (healRes.ok) setPendingActions((await healRes.json()).actions)
    setLoading(false)
  }, [statusFilter])

  useEffect(() => { fetchData() }, [fetchData])

  async function approveAction(id: string) {
    setActing(id)
    await fetch(`/api/heal/${id}/approve`, { method: 'POST' })
    await fetchData()
    setActing(null)
  }

  async function rejectAction(id: string) {
    setActing(id)
    await fetch(`/api/heal/${id}/reject`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: 'Rejected via UI' }) })
    await fetchData()
    setActing(null)
  }

  async function resolveIncident(id: string) {
    setActing(id)
    await fetch(`/api/incidents/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'RESOLVED' }) })
    await fetchData()
    setActing(null)
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Incidents</h1>
          <p className="text-sm text-muted-foreground mt-1">Active incidents and self-healing approval queue</p>
        </div>
        <button onClick={fetchData} className="flex items-center gap-2 border px-3 py-2 rounded-lg text-sm hover:bg-muted">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* HITL Approval Queue */}
      {pendingActions.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Awaiting Approval ({pendingActions.length})
          </h2>
          <div className="space-y-2">
            {pendingActions.map(action => (
              <div key={action.id} className="border border-yellow-200 dark:border-yellow-800 rounded-xl p-4 bg-yellow-50/50 dark:bg-yellow-900/10">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{action.title}</div>
                    {action.description && <div className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{action.description}</div>}
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={`text-xs font-medium ${RISK_COLORS[action.riskLevel] ?? 'text-muted-foreground'}`}>
                        {action.riskLevel} RISK
                      </span>
                      <span className="text-xs text-muted-foreground">· {action.fixType}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => approveAction(action.id)}
                      disabled={acting === action.id}
                      className="flex items-center gap-1.5 bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50"
                    >
                      {acting === action.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ThumbsUp className="w-3.5 h-3.5" />}
                      Approve
                    </button>
                    <button
                      onClick={() => rejectAction(action.id)}
                      disabled={acting === action.id}
                      className="flex items-center gap-1.5 border border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50"
                    >
                      {acting === action.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ThumbsDown className="w-3.5 h-3.5" />}
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 border-b">
        {['OPEN', 'INVESTIGATING', 'RESOLVED'].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${statusFilter === s ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Incident list */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : incidents.length === 0 ? (
        <div className="border border-dashed rounded-xl p-12 text-center text-muted-foreground">
          <CheckCircle className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No {statusFilter.toLowerCase()} incidents</p>
        </div>
      ) : (
        <div className="space-y-2">
          {incidents.map(incident => (
            <div key={incident.id} className="border rounded-xl bg-card overflow-hidden">
              <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => setExpanded(expanded === incident.id ? null : incident.id)}>
                <div className="shrink-0">{STATUS_ICON[incident.status] ?? <AlertTriangle className="w-4 h-4" />}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{incident.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {incident.source} · {new Date(incident.startedAt).toLocaleString()}
                    {incident.healActions.length > 0 && ` · ${incident.healActions.length} heal action(s)`}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEV_COLORS[incident.severity] ?? ''}`}>
                    {incident.severity}
                  </span>
                  {incident.status === 'OPEN' && (
                    <button
                      onClick={e => { e.stopPropagation(); resolveIncident(incident.id) }}
                      disabled={acting === incident.id}
                      className="text-xs border px-2 py-0.5 rounded-md hover:bg-muted"
                    >
                      {acting === incident.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Resolve'}
                    </button>
                  )}
                  {expanded === incident.id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>
              </div>

              {expanded === incident.id && (
                <div className="border-t px-4 py-3 space-y-3 bg-muted/20 text-sm">
                  {incident.rootCause && (
                    <div>
                      <span className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Root Cause</span>
                      <p className="mt-0.5">{incident.rootCause}</p>
                    </div>
                  )}
                  {incident.externalRef && (
                    <div>
                      <span className="text-xs uppercase tracking-wide text-muted-foreground font-medium">External Ref</span>
                      <p className="mt-0.5 font-mono text-xs">{incident.externalRef}</p>
                    </div>
                  )}
                  {incident.healActions.length > 0 && (
                    <div>
                      <span className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Heal Actions</span>
                      <div className="mt-1.5 space-y-1">
                        {incident.healActions.map(ha => (
                          <div key={ha.id} className="flex items-center justify-between border rounded-lg px-3 py-1.5 bg-background">
                            <span>{ha.title}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${HEAL_STATUS_COLORS[ha.status] ?? ''}`}>{ha.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
