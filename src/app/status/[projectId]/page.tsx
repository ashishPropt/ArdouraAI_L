import { notFound } from 'next/navigation'

interface Check { status: string; checkedAt: string }
interface MonitorData {
  id: string; name: string; lastStatus: string | null
  lastCheckedAt: string | null; uptimePct: number | null
  recentChecks: Check[]
}
interface IncidentData {
  id: string; title: string; severity: string; status: string
  source: string; startedAt: string; resolvedAt: string | null; resolution: string | null
}

async function getData(projectId: string) {
  const base = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const res = await fetch(`${base}/api/status/${projectId}`, { next: { revalidate: 60 } })
  if (!res.ok) return null
  return res.json()
}

const OVERALL_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  operational: { label: 'All Systems Operational', color: 'text-green-700', bg: 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' },
  degraded:    { label: 'Partial Degradation',     color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800' },
  outage:      { label: 'Service Outage',           color: 'text-red-700',   bg: 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800' },
  unknown:     { label: 'No Monitors Configured',   color: 'text-gray-600',  bg: 'bg-gray-50 border-gray-200 dark:bg-slate-800 dark:border-slate-700' },
}

function StatusBadge({ status }: { status: string | null }) {
  const cfg: Record<string, { label: string; dot: string }> = {
    UP:       { label: 'Operational', dot: 'bg-green-500' },
    DOWN:     { label: 'Outage',      dot: 'bg-red-500 animate-pulse' },
    DEGRADED: { label: 'Degraded',    dot: 'bg-yellow-500' },
    TIMEOUT:  { label: 'Timeout',     dot: 'bg-orange-500' },
  }
  const c = status ? cfg[status] : { label: 'Unknown', dot: 'bg-gray-400' }
  return (
    <div className="flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${c.dot}`} />
      <span className="text-sm font-medium">{c.label}</span>
    </div>
  )
}

function UptimeBar({ checks }: { checks: Check[] }) {
  if (checks.length === 0) return <div className="flex gap-0.5">{Array.from({ length: 30 }).map((_, i) => <div key={i} className="w-2 h-6 rounded-sm bg-gray-200 dark:bg-slate-700" />)}</div>
  const padded = [...Array.from({ length: Math.max(0, 30 - checks.length) }).map(() => null), ...checks].slice(-30)
  return (
    <div className="flex gap-0.5">
      {padded.map((c, i) => (
        <div
          key={i}
          title={c ? `${c.status} — ${new Date(c.checkedAt).toLocaleString()}` : 'No data'}
          className={`w-2 h-6 rounded-sm ${!c ? 'bg-gray-200 dark:bg-slate-700' : c.status === 'UP' ? 'bg-green-500' : c.status === 'DOWN' ? 'bg-red-500' : c.status === 'TIMEOUT' ? 'bg-orange-400' : 'bg-yellow-400'}`}
        />
      ))}
    </div>
  )
}

export default async function StatusPage({ params }: { params: { projectId: string } }) {
  const data = await getData(params.projectId)
  if (!data) notFound()

  const cfg = OVERALL_CONFIG[data.overallStatus] ?? OVERALL_CONFIG.unknown
  const openIncidents = data.incidents.filter((i: IncidentData) => i.status === 'OPEN')
  const resolvedIncidents = data.incidents.filter((i: IncidentData) => i.status === 'RESOLVED')

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{data.project.name}</h1>
          <p className="text-sm text-gray-500 mt-1">Status Page · Updated {new Date(data.generatedAt).toLocaleString()}</p>
        </div>

        {/* Overall status banner */}
        <div className={`border rounded-2xl p-5 mb-8 ${cfg.bg}`}>
          <p className={`text-lg font-semibold ${cfg.color}`}>{cfg.label}</p>
          {data.project.deployedUrl && (
            <a href={data.project.deployedUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-gray-500 hover:text-gray-700 mt-1 inline-block">
              {data.project.deployedUrl} ↗
            </a>
          )}
        </div>

        {/* Monitors */}
        {data.monitors.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Services</h2>
            <div className="border rounded-2xl divide-y dark:border-slate-800 dark:divide-slate-800 overflow-hidden">
              {data.monitors.map((m: MonitorData) => (
                <div key={m.id} className="p-4 bg-white dark:bg-slate-900">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{m.name}</p>
                      {m.lastCheckedAt && (
                        <p className="text-xs text-gray-400 mt-0.5">Last checked {new Date(m.lastCheckedAt).toLocaleTimeString()}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      {m.uptimePct !== null && (
                        <span className="text-xs text-gray-500">{m.uptimePct}% uptime</span>
                      )}
                      <StatusBadge status={m.lastStatus} />
                    </div>
                  </div>
                  <UptimeBar checks={m.recentChecks} />
                  <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                    <span>30 days ago</span>
                    <span>Today</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active incidents */}
        {openIncidents.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-red-500 uppercase tracking-wide mb-3">Active Incidents</h2>
            <div className="space-y-3">
              {openIncidents.map((inc: IncidentData) => (
                <div key={inc.id} className="border border-red-200 dark:border-red-900 rounded-2xl p-4 bg-red-50 dark:bg-red-900/10">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded">{inc.severity}</span>
                    <p className="font-medium text-gray-900 dark:text-white">{inc.title}</p>
                  </div>
                  <p className="text-xs text-gray-500">Started {new Date(inc.startedAt).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Resolved incidents */}
        {resolvedIncidents.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Recent Incidents</h2>
            <div className="border rounded-2xl divide-y dark:border-slate-800 dark:divide-slate-800 overflow-hidden">
              {resolvedIncidents.slice(0, 5).map((inc: IncidentData) => (
                <div key={inc.id} className="p-4 bg-white dark:bg-slate-900">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{inc.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{new Date(inc.startedAt).toLocaleDateString()}</p>
                    </div>
                    <span className="text-xs text-green-600 dark:text-green-400 font-medium">Resolved</span>
                  </div>
                  {inc.resolution && <p className="text-xs text-gray-500 mt-1">{inc.resolution}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {data.monitors.length === 0 && data.incidents.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p className="text-sm">No monitoring data available yet.</p>
          </div>
        )}

        <div className="mt-12 text-center">
          <p className="text-xs text-gray-400">Powered by <span className="font-semibold text-ardoura-500">ArdouraAI</span></p>
        </div>
      </div>
    </div>
  )
}
