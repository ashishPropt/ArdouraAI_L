'use client'

import { useEffect, useState, useCallback } from 'react'
import { Workflow, Plus, Play, Trash2, ToggleLeft, ToggleRight, Clock, Globe, Zap, Hand, ChevronRight, CheckCircle2, XCircle, Loader2, RefreshCw } from 'lucide-react'

type StepType = 'LLM_GENERATE' | 'HTTP_REQUEST' | 'CONDITION' | 'NOTIFY' | 'TRANSFORM'
type TriggerType = 'MANUAL' | 'CRON' | 'WEBHOOK' | 'INCIDENT'
type RunStatus = 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'

interface WorkflowStep {
  id: string; name: string; stepOrder: number; type: StepType; config: Record<string, unknown>
}
interface WorkflowData {
  id: string; name: string; description?: string
  trigger: TriggerType; cronExpr?: string; webhookSecret?: string
  active: boolean; lastRunAt?: string; createdAt: string
  projectId: string
  steps: WorkflowStep[]
  _count: { runs: number }
}
interface RunLog {
  id: string; stepName?: string; status: string; durationMs?: number; output?: unknown; error?: string; createdAt: string
}
interface WorkflowRun {
  id: string; status: RunStatus; triggeredBy?: string
  startedAt: string; completedAt?: string; error?: string
  logs: RunLog[]
}
interface Project { id: string; name: string }

const TRIGGER_ICON: Record<TriggerType, React.ReactNode> = {
  MANUAL:   <Hand className="w-3 h-3" />,
  CRON:     <Clock className="w-3 h-3" />,
  WEBHOOK:  <Globe className="w-3 h-3" />,
  INCIDENT: <Zap className="w-3 h-3" />,
}
const TRIGGER_COLOR: Record<TriggerType, string> = {
  MANUAL:   'bg-slate-700 text-slate-300',
  CRON:     'bg-blue-900/50 text-blue-300',
  WEBHOOK:  'bg-purple-900/50 text-purple-300',
  INCIDENT: 'bg-orange-900/50 text-orange-300',
}
const STEP_COLORS: Record<StepType, string> = {
  LLM_GENERATE: 'bg-violet-900/40 text-violet-300',
  HTTP_REQUEST:  'bg-blue-900/40 text-blue-300',
  CONDITION:     'bg-yellow-900/40 text-yellow-300',
  NOTIFY:        'bg-green-900/40 text-green-300',
  TRANSFORM:     'bg-slate-700 text-slate-300',
}
const RUN_STATUS_CONFIG: Record<RunStatus, { color: string; icon: React.ReactNode }> = {
  RUNNING:   { color: 'text-blue-400', icon: <Loader2 className="w-3 h-3 animate-spin" /> },
  COMPLETED: { color: 'text-green-400', icon: <CheckCircle2 className="w-3 h-3" /> },
  FAILED:    { color: 'text-red-400',   icon: <XCircle className="w-3 h-3" /> },
  CANCELLED: { color: 'text-slate-400', icon: <XCircle className="w-3 h-3" /> },
}

const DEFAULT_STEP = (): Partial<WorkflowStep> => ({ name: 'New Step', type: 'HTTP_REQUEST', config: { url: '', method: 'GET' } })

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<WorkflowData[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [selected, setSelected] = useState<WorkflowData | null>(null)
  const [runs, setRuns] = useState<WorkflowRun[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [expandedRun, setExpandedRun] = useState<string | null>(null)

  const [form, setForm] = useState({ projectId: '', name: '', description: '', trigger: 'MANUAL' as TriggerType, cronExpr: '', steps: [DEFAULT_STEP()] })

  const loadWorkflows = useCallback(async () => {
    setLoading(true)
    const [wRes, pRes] = await Promise.all([fetch('/api/workflows'), fetch('/api/projects')])
    if (wRes.ok) setWorkflows(await wRes.json())
    if (pRes.ok) setProjects(await pRes.json())
    setLoading(false)
  }, [])

  useEffect(() => { loadWorkflows() }, [loadWorkflows])

  async function loadRuns(wf: WorkflowData) {
    setSelected(wf)
    const res = await fetch(`/api/workflows/${wf.id}/runs`)
    if (res.ok) setRuns(await res.json())
    else setRuns([])
  }

  async function runWorkflow(wf: WorkflowData, e: React.MouseEvent) {
    e.stopPropagation()
    setRunning(true)
    const res = await fetch(`/api/workflows/${wf.id}/run`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    setRunning(false)
    if (res.ok) {
      if (selected?.id === wf.id) {
        const updated = await fetch(`/api/workflows/${wf.id}/runs`)
        if (updated.ok) setRuns(await updated.json())
      }
      await loadWorkflows()
    }
  }

  async function toggleActive(wf: WorkflowData, e: React.MouseEvent) {
    e.stopPropagation()
    await fetch(`/api/workflows/${wf.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !wf.active }),
    })
    loadWorkflows()
  }

  async function deleteWorkflow(wf: WorkflowData, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm(`Delete "${wf.name}"?`)) return
    await fetch(`/api/workflows/${wf.id}`, { method: 'DELETE' })
    if (selected?.id === wf.id) { setSelected(null); setRuns([]) }
    loadWorkflows()
  }

  async function createWorkflow() {
    if (!form.projectId || !form.name.trim()) return
    const res = await fetch('/api/workflows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, steps: form.steps.filter(s => s.name) }),
    })
    if (res.ok) {
      setShowCreate(false)
      setForm({ projectId: '', name: '', description: '', trigger: 'MANUAL', cronExpr: '', steps: [DEFAULT_STEP()] })
      loadWorkflows()
    }
  }

  function msToHuman(ms?: number) {
    if (!ms) return '—'
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
  }

  return (
    <div className="flex h-full">
      {/* Left panel — workflow list */}
      <div className="w-72 border-r border-slate-800 flex flex-col">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Workflow className="w-5 h-5 text-ardoura-400" />
            <h1 className="font-semibold text-white">Workflows</h1>
          </div>
          <button onClick={() => setShowCreate(true)} className="w-7 h-7 flex items-center justify-center bg-ardoura-600 hover:bg-ardoura-500 rounded-lg transition-colors">
            <Plus className="w-4 h-4 text-white" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>
          ) : workflows.length === 0 ? (
            <div className="p-6 text-center text-slate-500">
              <Workflow className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No workflows yet</p>
              <button onClick={() => setShowCreate(true)} className="mt-3 text-xs text-ardoura-400 hover:text-ardoura-300">Create one →</button>
            </div>
          ) : (
            workflows.map(wf => (
              <div
                key={wf.id}
                onClick={() => loadRuns(wf)}
                className={`p-3 border-b border-slate-800 cursor-pointer hover:bg-slate-800/50 transition-colors ${selected?.id === wf.id ? 'bg-slate-800/70' : ''}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium text-white truncate max-w-[150px]">{wf.name}</p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 ${TRIGGER_COLOR[wf.trigger]}`}>
                    {TRIGGER_ICON[wf.trigger]}{wf.trigger}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">{wf.steps.length} step{wf.steps.length !== 1 ? 's' : ''} · {wf._count.runs} runs</span>
                  <div className="flex items-center gap-1">
                    <button onClick={e => runWorkflow(wf, e)} disabled={running} className="p-1 hover:text-ardoura-400 text-slate-500 transition-colors" title="Run now">
                      <Play className="w-3 h-3" />
                    </button>
                    <button onClick={e => toggleActive(wf, e)} className={`p-1 transition-colors ${wf.active ? 'text-green-400 hover:text-slate-400' : 'text-slate-600 hover:text-green-400'}`}>
                      {wf.active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                    </button>
                    <button onClick={e => deleteWorkflow(wf, e)} className="p-1 hover:text-red-400 text-slate-600 transition-colors">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right panel — workflow detail */}
      <div className="flex-1 overflow-y-auto">
        {!selected ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <Workflow className="w-12 h-12 mb-3 opacity-20" />
            <p className="text-sm">Select a workflow to view details</p>
          </div>
        ) : (
          <div className="p-6 max-w-3xl">
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-white">{selected.name}</h2>
                {selected.description && <p className="text-sm text-slate-400 mt-1">{selected.description}</p>}
                <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                  <span className={`px-2 py-0.5 rounded flex items-center gap-1 ${TRIGGER_COLOR[selected.trigger]}`}>
                    {TRIGGER_ICON[selected.trigger]} {selected.trigger}
                  </span>
                  {selected.cronExpr && <span className="font-mono">{selected.cronExpr}</span>}
                  {selected.webhookSecret && (
                    <span className="font-mono truncate max-w-[200px]" title={`Secret: ${selected.webhookSecret}`}>
                      Webhook: {selected.webhookSecret.slice(0, 8)}…
                    </span>
                  )}
                  {selected.lastRunAt && <span>Last run {new Date(selected.lastRunAt).toLocaleString()}</span>}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={async () => { setRunning(true); await fetch(`/api/workflows/${selected.id}/run`, { method: 'POST', body: '{}', headers: {'Content-Type':'application/json'} }); const r = await fetch(`/api/workflows/${selected.id}/runs`); if(r.ok) setRuns(await r.json()); setRunning(false) }}
                  disabled={running} className="flex items-center gap-1.5 bg-ardoura-600 hover:bg-ardoura-500 disabled:opacity-50 text-white text-sm px-3 py-2 rounded-lg transition-colors">
                  {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  Run
                </button>
                <button onClick={() => { const r = fetch(`/api/workflows/${selected.id}/runs`).then(x => x.json()).then(setRuns) }} className="border border-slate-700 hover:bg-slate-800 text-slate-400 px-3 py-2 rounded-lg text-sm transition-colors">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Steps */}
            <div className="mb-6">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Steps</h3>
              {selected.steps.length === 0 ? (
                <p className="text-sm text-slate-500">No steps configured</p>
              ) : (
                <div className="space-y-2">
                  {selected.steps.map((step, i) => (
                    <div key={step.id} className="flex items-center gap-3">
                      <span className="w-5 h-5 rounded-full bg-slate-700 text-slate-400 text-xs flex items-center justify-center flex-shrink-0">{i + 1}</span>
                      <div className="flex-1 border border-slate-800 rounded-lg p-3 bg-slate-900">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${STEP_COLORS[step.type]}`}>{step.type}</span>
                          <span className="text-sm text-white">{step.name}</span>
                        </div>
                        {step.config && Object.keys(step.config).length > 0 && (
                          <p className="text-xs text-slate-500 mt-1 font-mono truncate">
                            {JSON.stringify(step.config).slice(0, 80)}…
                          </p>
                        )}
                      </div>
                      {i < selected.steps.length - 1 && <ChevronRight className="w-4 h-4 text-slate-600 flex-shrink-0" />}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Run history */}
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Recent Runs</h3>
              {runs.length === 0 ? (
                <p className="text-sm text-slate-500">No runs yet. Click Run to execute this workflow.</p>
              ) : (
                <div className="space-y-2">
                  {runs.map(run => {
                    const cfg = RUN_STATUS_CONFIG[run.status]
                    const dur = run.completedAt
                      ? new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()
                      : null
                    return (
                      <div key={run.id} className="border border-slate-800 rounded-lg overflow-hidden">
                        <button
                          onClick={() => setExpandedRun(expandedRun === run.id ? null : run.id)}
                          className="w-full flex items-center justify-between p-3 hover:bg-slate-800/50 transition-colors text-left"
                        >
                          <div className="flex items-center gap-2">
                            <span className={`flex items-center gap-1 text-xs font-medium ${cfg.color}`}>{cfg.icon}{run.status}</span>
                            <span className="text-xs text-slate-500 font-mono">{run.id.slice(0, 8)}</span>
                            {run.triggeredBy && <span className="text-xs text-slate-600">by {run.triggeredBy.slice(0, 8)}</span>}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-500">
                            {dur !== null && <span>{msToHuman(dur)}</span>}
                            <span>{new Date(run.startedAt).toLocaleTimeString()}</span>
                            <span className="text-slate-600">{expandedRun === run.id ? '▲' : '▼'}</span>
                          </div>
                        </button>

                        {expandedRun === run.id && (
                          <div className="border-t border-slate-800 p-3 space-y-2 bg-slate-900/50">
                            {run.error && (
                              <div className="text-xs text-red-400 bg-red-900/20 rounded p-2 font-mono">{run.error}</div>
                            )}
                            {run.logs.map((log, i) => (
                              <div key={log.id} className="flex items-start gap-2 text-xs">
                                <span className="text-slate-600 w-4">{i + 1}</span>
                                <span className={log.status === 'SUCCESS' ? 'text-green-400' : 'text-red-400'} >{log.status}</span>
                                <span className="text-slate-400">{log.stepName ?? '—'}</span>
                                <span className="text-slate-600">{msToHuman(log.durationMs)}</span>
                                {log.error && <span className="text-red-400 font-mono truncate max-w-[200px]">{log.error}</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-800">
              <h2 className="text-lg font-semibold text-white">New Workflow</h2>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Project *</label>
                <select value={form.projectId} onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))} className="w-full border border-slate-700 rounded-lg px-3 py-2 text-sm bg-slate-800 text-white">
                  <option value="">Select project…</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="My workflow" className="w-full border border-slate-700 rounded-lg px-3 py-2 text-sm bg-slate-800 text-white placeholder-slate-500" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Description</label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional description" className="w-full border border-slate-700 rounded-lg px-3 py-2 text-sm bg-slate-800 text-white placeholder-slate-500" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Trigger</label>
                <select value={form.trigger} onChange={e => setForm(f => ({ ...f, trigger: e.target.value as TriggerType }))} className="w-full border border-slate-700 rounded-lg px-3 py-2 text-sm bg-slate-800 text-white">
                  <option value="MANUAL">Manual</option>
                  <option value="CRON">Cron schedule</option>
                  <option value="WEBHOOK">Webhook</option>
                  <option value="INCIDENT">Incident</option>
                </select>
              </div>
              {form.trigger === 'CRON' && (
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Cron Expression</label>
                  <input value={form.cronExpr} onChange={e => setForm(f => ({ ...f, cronExpr: e.target.value }))} placeholder="0 9 * * 1 (every Monday 9am)" className="w-full border border-slate-700 rounded-lg px-3 py-2 text-sm bg-slate-800 text-white font-mono placeholder-slate-500" />
                </div>
              )}

              {/* Steps builder */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-slate-400">Steps</label>
                  <button onClick={() => setForm(f => ({ ...f, steps: [...f.steps, DEFAULT_STEP()] }))} className="text-xs text-ardoura-400 hover:text-ardoura-300">+ Add step</button>
                </div>
                {form.steps.map((step, i) => (
                  <div key={i} className="border border-slate-700 rounded-lg p-3 mb-2 space-y-2">
                    <div className="flex gap-2">
                      <input
                        value={step.name ?? ''}
                        onChange={e => setForm(f => { const s = [...f.steps]; s[i] = { ...s[i], name: e.target.value }; return { ...f, steps: s } })}
                        placeholder="Step name"
                        className="flex-1 border border-slate-700 rounded px-2 py-1 text-xs bg-slate-800 text-white"
                      />
                      <select
                        value={step.type ?? 'HTTP_REQUEST'}
                        onChange={e => setForm(f => { const s = [...f.steps]; s[i] = { ...s[i], type: e.target.value as StepType }; return { ...f, steps: s } })}
                        className="border border-slate-700 rounded px-2 py-1 text-xs bg-slate-800 text-white"
                      >
                        <option value="LLM_GENERATE">LLM Generate</option>
                        <option value="HTTP_REQUEST">HTTP Request</option>
                        <option value="CONDITION">Condition</option>
                        <option value="NOTIFY">Notify</option>
                        <option value="TRANSFORM">Transform</option>
                      </select>
                      {form.steps.length > 1 && (
                        <button onClick={() => setForm(f => { const s = f.steps.filter((_, j) => j !== i); return { ...f, steps: s } })} className="text-red-400 hover:text-red-300 px-1">✕</button>
                      )}
                    </div>
                    {step.type === 'HTTP_REQUEST' && (
                      <input
                        defaultValue={(step.config?.url as string) ?? ''}
                        onBlur={e => setForm(f => { const s = [...f.steps]; s[i] = { ...s[i], config: { ...s[i].config, url: e.target.value } }; return { ...f, steps: s } })}
                        placeholder="https://api.example.com/endpoint"
                        className="w-full border border-slate-700 rounded px-2 py-1 text-xs bg-slate-800 text-slate-300 font-mono"
                      />
                    )}
                    {step.type === 'LLM_GENERATE' && (
                      <textarea
                        defaultValue={(step.config?.prompt as string) ?? ''}
                        onBlur={e => setForm(f => { const s = [...f.steps]; s[i] = { ...s[i], config: { ...s[i].config, prompt: e.target.value } }; return { ...f, steps: s } })}
                        placeholder="Prompt text — use {{input.field}} for substitution"
                        rows={2}
                        className="w-full border border-slate-700 rounded px-2 py-1 text-xs bg-slate-800 text-slate-300 font-mono resize-none"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="p-5 border-t border-slate-800 flex justify-end gap-2">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-white rounded-lg transition-colors">Cancel</button>
              <button onClick={createWorkflow} disabled={!form.projectId || !form.name} className="px-4 py-2 text-sm bg-ardoura-600 hover:bg-ardoura-500 disabled:opacity-50 text-white rounded-lg transition-colors">
                Create Workflow
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
