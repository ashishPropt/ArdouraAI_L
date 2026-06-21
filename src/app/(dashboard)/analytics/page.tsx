'use client'

import { useEffect, useState, useCallback } from 'react'
import { BarChart2, Loader2, RefreshCw, TrendingUp, AlertTriangle, Zap, CheckCircle2, Activity } from 'lucide-react'

interface DailyCost { date: string; cost: number }
interface MonitorStat { id: string; name: string; projectId: string; uptimePct: number | null; totalChecks: number }
interface Project { id: string; name: string; fileCount: number; messageCount: number; deployedUrl: string | null; status: string }
interface GroupCount { _count: { id: number } }

function UptimeBar({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-xs text-muted-foreground">No data</span>
  const color = pct >= 99 ? 'bg-green-500' : pct >= 95 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-mono w-12 text-right ${pct >= 99 ? 'text-green-400' : pct >= 95 ? 'text-yellow-400' : 'text-red-400'}`}>{pct}%</span>
    </div>
  )
}

function CostSparkline({ data }: { data: DailyCost[] }) {
  if (data.length === 0) return <span className="text-xs text-muted-foreground">No cost data</span>
  const max = Math.max(...data.map(d => d.cost), 0.0001)
  return (
    <div className="flex items-end gap-0.5 h-12 mt-2">
      {data.map(d => (
        <div key={d.date} title={`${d.date}: $${d.cost.toFixed(4)}`} className="flex-1 bg-ardoura-600/70 rounded-t hover:bg-ardoura-400 transition-colors" style={{ height: `${Math.max(4, (d.cost / max) * 100)}%` }} />
      ))}
    </div>
  )
}

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/analytics?days=${days}`)
    if (res.ok) setData(await res.json())
    setLoading(false)
  }, [days])

  useEffect(() => { load() }, [load])

  const totalIncidents = data?.incidentsBySeverity?.reduce((s: number, x: any) => s + x._count.id, 0) ?? 0
  const openIncidents = data?.incidentsByStatus?.find((x: any) => x.status === 'OPEN')?._count?.id ?? 0
  const avgUptime = data?.uptimeByMonitor?.length > 0
    ? (data.uptimeByMonitor.filter((m: MonitorStat) => m.uptimePct !== null).reduce((s: number, m: MonitorStat) => s + (m.uptimePct ?? 0), 0) / data.uptimeByMonitor.filter((m: MonitorStat) => m.uptimePct !== null).length).toFixed(1)
    : null
  const approvedHeals = data?.healStats?.find((x: any) => x.status === 'APPLIED')?._count?.id ?? 0

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-ardoura-400" /> Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Platform-wide health and cost metrics</p>
        </div>
        <div className="flex gap-2">
          <select value={days} onChange={e => setDays(Number(e.target.value))} className="border rounded-lg px-3 py-2 text-sm bg-background">
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button onClick={load} className="border px-3 py-2 rounded-lg text-sm hover:bg-muted">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Total Projects', value: data?.projects?.length ?? 0, icon: <BarChart2 className="w-4 h-4 text-ardoura-400" />, sub: `${data?.projects?.filter((p: Project) => p.deployedUrl).length ?? 0} deployed` },
              { label: 'Total Incidents', value: totalIncidents, icon: <AlertTriangle className="w-4 h-4 text-orange-400" />, sub: `${openIncidents} open` },
              { label: 'Avg Uptime', value: avgUptime ? `${avgUptime}%` : '—', icon: <Activity className="w-4 h-4 text-green-400" />, sub: `${data?.uptimeByMonitor?.length ?? 0} monitors` },
              { label: 'LLM Spend', value: `$${(data?.llmTotal ?? 0).toFixed(4)}`, icon: <Zap className="w-4 h-4 text-yellow-400" />, sub: `${approvedHeals} auto-heals` },
            ].map(({ label, value, icon, sub }) => (
              <div key={label} className="border rounded-xl p-4 bg-card">
                <div className="text-xs text-muted-foreground flex items-center gap-1.5">{icon}{label}</div>
                <div className="text-2xl font-bold mt-1">{value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
              </div>
            ))}
          </div>

          {/* Daily LLM cost chart */}
          <div className="border rounded-xl p-5 bg-card mb-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold">Daily LLM Cost</h2>
              <span className="text-xs text-muted-foreground">last {days} days</span>
            </div>
            <CostSparkline data={data?.dailyCost ?? []} />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>{data?.dailyCost?.[0]?.date ?? ''}</span>
              <span>{data?.dailyCost?.[data.dailyCost.length - 1]?.date ?? ''}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            {/* Projects table */}
            <div className="border rounded-xl bg-card overflow-hidden">
              <div className="px-4 py-3 border-b">
                <h2 className="text-sm font-semibold">Projects</h2>
              </div>
              {(data?.projects ?? []).length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No projects yet</p>
              ) : (
                <div className="divide-y">
                  {(data?.projects ?? []).slice(0, 8).map((p: Project) => (
                    <div key={p.id} className="px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium truncate max-w-[140px]">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.fileCount} files · {p.messageCount} msgs</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${p.deployedUrl ? 'bg-green-500/10 text-green-400' : 'bg-muted text-muted-foreground'}`}>
                        {p.deployedUrl ? 'Live' : p.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Incident breakdown */}
            <div className="border rounded-xl bg-card overflow-hidden">
              <div className="px-4 py-3 border-b">
                <h2 className="text-sm font-semibold">Incidents by Severity</h2>
              </div>
              {(data?.incidentsBySeverity ?? []).length === 0 ? (
                <div className="p-6 flex flex-col items-center text-muted-foreground">
                  <CheckCircle2 className="w-8 h-8 mb-2 text-green-400 opacity-60" />
                  <p className="text-sm">No incidents in this period</p>
                </div>
              ) : (
                <div className="divide-y">
                  {(['P1','P2','P3','P4'] as const).map(sev => {
                    const entry = (data?.incidentsBySeverity ?? []).find((x: any) => x.severity === sev)
                    const count = entry?._count?.id ?? 0
                    if (count === 0) return null
                    const colors: Record<string, string> = { P1: 'bg-red-500', P2: 'bg-orange-500', P3: 'bg-yellow-500', P4: 'bg-blue-500' }
                    const maxCount = Math.max(...(data?.incidentsBySeverity ?? []).map((x: any) => x._count.id))
                    return (
                      <div key={sev} className="px-4 py-3 flex items-center gap-3">
                        <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${colors[sev]}/20 text-${sev === 'P1' ? 'red' : sev === 'P2' ? 'orange' : sev === 'P3' ? 'yellow' : 'blue'}-400`}>{sev}</span>
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${colors[sev]}`} style={{ width: `${(count / maxCount) * 100}%` }} />
                        </div>
                        <span className="text-sm font-medium w-6 text-right">{count}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Uptime by monitor */}
          {(data?.uptimeByMonitor ?? []).length > 0 && (
            <div className="border rounded-xl bg-card overflow-hidden mb-6">
              <div className="px-4 py-3 border-b">
                <h2 className="text-sm font-semibold">Monitor Uptime — last {days} days</h2>
              </div>
              <div className="divide-y">
                {(data?.uptimeByMonitor ?? []).map((m: MonitorStat) => (
                  <div key={m.id} className="px-4 py-3 flex items-center gap-4">
                    <span className="text-sm font-medium w-40 truncate">{m.name}</span>
                    <div className="flex-1">
                      <UptimeBar pct={m.uptimePct} />
                    </div>
                    <span className="text-xs text-muted-foreground w-16 text-right">{m.totalChecks} checks</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Heal action stats */}
          {(data?.healStats ?? []).length > 0 && (
            <div className="border rounded-xl bg-card p-4">
              <h2 className="text-sm font-semibold mb-3">Auto-Heal Actions — last {days} days</h2>
              <div className="flex flex-wrap gap-3">
                {(data?.healStats ?? []).map((s: any) => {
                  const colors: Record<string, string> = {
                    APPLIED: 'bg-green-500/10 text-green-400 border-green-500/20',
                    REJECTED: 'bg-red-500/10 text-red-400 border-red-500/20',
                    PENDING: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
                    FAILED: 'bg-red-900/30 text-red-300 border-red-800/30',
                  }
                  return (
                    <div key={s.status} className={`border rounded-xl px-4 py-2 ${colors[s.status] ?? 'bg-muted'}`}>
                      <p className="text-lg font-bold">{s._count.id}</p>
                      <p className="text-xs">{s.status}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
