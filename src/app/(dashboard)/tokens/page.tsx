'use client'

import { useEffect, useState, useCallback } from 'react'
import { Zap, RefreshCw, Loader2, Plus, TrendingUp } from 'lucide-react'

interface ModelStat {
  model: string
  _sum: { inputTokens: number | null; outputTokens: number | null; costUsd: number | null }
  _count: { id: number }
}

interface UsageLog {
  id: string
  model: string
  provider: string
  feature: string
  inputTokens: number
  outputTokens: number
  costUsd: number
  createdAt: string
}

interface Budget {
  id: string
  name: string
  limitUsd: number
  currentUsd: number
  model?: string
  action: string
  alertPct: number
  createdAt: string
}

interface Totals {
  costUsd: number | null
  inputTokens: number | null
  outputTokens: number | null
}

const MODEL_COLORS: Record<string, string> = {
  'claude': '#7C3AED',
  'gpt': '#10B981',
  'gemini': '#3B82F6',
}
function modelColor(model: string) {
  for (const [k, v] of Object.entries(MODEL_COLORS)) {
    if (model.toLowerCase().includes(k)) return v
  }
  return '#6B7280'
}

export default function TokensPage() {
  const [byModel, setByModel] = useState<ModelStat[]>([])
  const [logs, setLogs] = useState<UsageLog[]>([])
  const [totals, setTotals] = useState<Totals>({ costUsd: null, inputTokens: null, outputTokens: null })
  const [callCount, setCallCount] = useState(0)
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)
  const [showAddBudget, setShowAddBudget] = useState(false)
  const [newBudget, setNewBudget] = useState({ name: '', limitUsd: '', model: '', alertPct: '80' })
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [usageRes, budgetRes] = await Promise.all([
      fetch(`/api/tokens/usage?days=${days}`),
      fetch('/api/tokens/budgets'),
    ])
    if (usageRes.ok) {
      const d = await usageRes.json()
      setByModel(d.byModel)
      setLogs(d.logs)
      setTotals(d.totals ?? {})
      setCallCount(d.callCount ?? 0)
    }
    if (budgetRes.ok) setBudgets((await budgetRes.json()).budgets)
    setLoading(false)
  }, [days])

  useEffect(() => { fetchData() }, [fetchData])

  async function saveBudget() {
    setSaving(true)
    await fetch('/api/tokens/budgets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newBudget),
    })
    setShowAddBudget(false)
    setNewBudget({ name: '', limitUsd: '', model: '', alertPct: '80' })
    await fetchData()
    setSaving(false)
  }

  const totalCost = totals?.costUsd ?? 0
  const maxModelCost = Math.max(...byModel.map(m => m._sum.costUsd ?? 0), 0.001)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Token Management</h1>
          <p className="text-sm text-muted-foreground mt-1">LLM usage, costs, and budget guardrails</p>
        </div>
        <div className="flex gap-2">
          <select value={days} onChange={e => setDays(Number(e.target.value))} className="border rounded-lg px-3 py-2 text-sm bg-background">
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button onClick={fetchData} className="border px-3 py-2 rounded-lg text-sm hover:bg-muted">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Total Spend', value: `$${(totalCost).toFixed(4)}`, icon: <TrendingUp className="w-4 h-4" /> },
              { label: 'API Calls', value: callCount.toLocaleString(), icon: <Zap className="w-4 h-4" /> },
              { label: 'Input Tokens', value: ((totals?.inputTokens ?? 0) / 1000).toFixed(1) + 'K', icon: null },
              { label: 'Output Tokens', value: ((totals?.outputTokens ?? 0) / 1000).toFixed(1) + 'K', icon: null },
            ].map(({ label, value, icon }) => (
              <div key={label} className="border rounded-xl p-4 bg-card">
                <div className="text-xs text-muted-foreground flex items-center gap-1">{icon}{label}</div>
                <div className="text-2xl font-bold mt-1">{value}</div>
              </div>
            ))}
          </div>

          {/* By model breakdown */}
          {byModel.length > 0 ? (
            <div className="border rounded-xl p-5 bg-card mb-6">
              <h2 className="text-sm font-semibold mb-4">Spend by Model</h2>
              <div className="space-y-3">
                {byModel.map(m => {
                  const cost = m._sum.costUsd ?? 0
                  const pct = (cost / maxModelCost) * 100
                  return (
                    <div key={m.model}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: modelColor(m.model) }} />
                          <span className="font-mono text-xs">{m.model}</span>
                          <span className="text-xs text-muted-foreground">{m._count.id} calls</span>
                        </div>
                        <span className="font-medium">${cost.toFixed(4)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: modelColor(m.model) }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="border border-dashed rounded-xl p-8 text-center text-muted-foreground mb-6">
              <Zap className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="font-medium">No LLM usage recorded yet</p>
              <p className="text-sm mt-1">Usage is logged automatically when the AI generates code or analyzes incidents</p>
            </div>
          )}

          {/* Budgets */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Budgets</h2>
              <button onClick={() => setShowAddBudget(true)} className="flex items-center gap-1 text-xs text-primary hover:underline">
                <Plus className="w-3 h-3" /> Add budget
              </button>
            </div>
            {budgets.length === 0 ? (
              <div className="border border-dashed rounded-xl p-6 text-center text-muted-foreground text-sm">
                No budgets set — add one to get alerts when spending exceeds a threshold
              </div>
            ) : (
              <div className="grid gap-2">
                {budgets.map(b => {
                  const pct = Math.min((b.currentUsd / b.limitUsd) * 100, 100)
                  const color = pct >= 90 ? 'bg-red-500' : pct >= b.alertPct ? 'bg-yellow-500' : 'bg-green-500'
                  return (
                    <div key={b.id} className="border rounded-xl p-4 bg-card">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="font-medium">{b.name}</span>
                          {b.model && <span className="text-xs text-muted-foreground ml-2">· {b.model}</span>}
                        </div>
                        <div className="text-sm">
                          <span className="font-mono">${b.currentUsd.toFixed(4)}</span>
                          <span className="text-muted-foreground"> / ${b.limitUsd}</span>
                        </div>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">{pct.toFixed(1)}% · alerts at {b.alertPct}% · action: {b.action}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Recent logs */}
          {logs.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Recent Calls</h2>
              <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="text-left px-4 py-2">Model</th>
                      <th className="text-left px-4 py-2">Feature</th>
                      <th className="text-right px-4 py-2">In</th>
                      <th className="text-right px-4 py-2">Out</th>
                      <th className="text-right px-4 py-2">Cost</th>
                      <th className="text-right px-4 py-2">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {logs.slice(0, 20).map(log => (
                      <tr key={log.id} className="hover:bg-muted/30">
                        <td className="px-4 py-2 font-mono text-xs">{log.model}</td>
                        <td className="px-4 py-2 text-muted-foreground">{log.feature}</td>
                        <td className="px-4 py-2 text-right font-mono text-xs">{log.inputTokens?.toLocaleString()}</td>
                        <td className="px-4 py-2 text-right font-mono text-xs">{log.outputTokens?.toLocaleString()}</td>
                        <td className="px-4 py-2 text-right font-mono text-xs">${(log.costUsd ?? 0).toFixed(5)}</td>
                        <td className="px-4 py-2 text-right text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleTimeString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Add Budget Modal */}
      {showAddBudget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4">Add Budget</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input type="text" value={newBudget.name} onChange={e => setNewBudget(b => ({ ...b, name: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm bg-background" placeholder="e.g. Monthly SRE budget" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Limit (USD)</label>
                <input type="number" value={newBudget.limitUsd} onChange={e => setNewBudget(b => ({ ...b, limitUsd: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm bg-background" placeholder="10.00" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Model filter <span className="text-muted-foreground font-normal">(optional)</span></label>
                <input type="text" value={newBudget.model} onChange={e => setNewBudget(b => ({ ...b, model: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm bg-background" placeholder="e.g. claude-sonnet" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Alert at (%)</label>
                <input type="number" value={newBudget.alertPct} onChange={e => setNewBudget(b => ({ ...b, alertPct: e.target.value }))} min={10} max={99} className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={saveBudget} disabled={saving || !newBudget.name || !newBudget.limitUsd} className="flex-1 bg-primary text-primary-foreground py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Save'}
                </button>
                <button onClick={() => setShowAddBudget(false)} className="flex-1 border py-2 rounded-lg text-sm font-medium hover:bg-muted">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
