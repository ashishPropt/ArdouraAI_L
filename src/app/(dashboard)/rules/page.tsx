'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2, Loader2, ToggleLeft, ToggleRight, Zap, ChevronDown, ChevronUp } from 'lucide-react'
import { ALL_TOPICS } from '@/lib/kafka/topics'
import { TOOL_REGISTRY } from '@/lib/mcp/registry'
import type { RuleCondition, RuleAction, ConditionOperator } from '@/lib/rules/types'

interface Rule {
  id: string
  name: string
  description?: string
  topic: string
  conditions: RuleCondition[]
  actions: RuleAction[]
  enabled: boolean
  cooldownMs?: number
  fireCount: number
  lastFiredAt?: string
}

const OPERATORS: { value: ConditionOperator; label: string }[] = [
  { value: 'eq', label: '= equals' },
  { value: 'neq', label: '≠ not equals' },
  { value: 'gt', label: '> greater than' },
  { value: 'gte', label: '≥ ≥' },
  { value: 'lt', label: '< less than' },
  { value: 'lte', label: '≤ ≤' },
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: 'not contains' },
  { value: 'in', label: 'in (comma list)' },
  { value: 'exists', label: 'exists' },
  { value: 'not_exists', label: 'not exists' },
]

const BLANK_CONDITION: RuleCondition = { field: 'severity', operator: 'eq', value: 'P1' }
const BLANK_ACTION: RuleAction = { tool: 'JIRA', action: 'create_issue', params: { summary: '{{event.message}}', description: '{{event.message}}' } }

export default function RulesPage() {
  const [rules, setRules] = useState<Rule[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: '', description: '', topic: 'obs.alert.triggered',
    conditions: [{ ...BLANK_CONDITION }] as RuleCondition[],
    actions: [{ ...BLANK_ACTION }] as RuleAction[],
    cooldownMs: 300000,
  })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => { fetchRules() }, [])

  async function fetchRules() {
    setLoading(true)
    const res = await fetch('/api/rules')
    if (res.ok) setRules((await res.json()).rules)
    setLoading(false)
  }

  async function toggleRule(rule: Rule) {
    setToggling(rule.id)
    await fetch(`/api/rules/${rule.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: !rule.enabled }) })
    setRules(prev => prev.map(r => r.id === rule.id ? { ...r, enabled: !r.enabled } : r))
    setToggling(null)
  }

  async function deleteRule(id: string) {
    if (!confirm('Delete this rule?')) return
    setDeleting(id)
    await fetch(`/api/rules/${id}`, { method: 'DELETE' })
    setRules(prev => prev.filter(r => r.id !== id))
    setDeleting(null)
  }

  async function saveRule() {
    setSaving(true)
    setSaveError('')
    const res = await fetch('/api/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (!res.ok) {
      setSaveError((await res.json()).error ?? 'Failed to save')
    } else {
      setShowAdd(false)
      resetForm()
      await fetchRules()
    }
    setSaving(false)
  }

  function resetForm() {
    setForm({ name: '', description: '', topic: 'obs.alert.triggered', conditions: [{ ...BLANK_CONDITION }], actions: [{ ...BLANK_ACTION }], cooldownMs: 300000 })
    setSaveError('')
  }

  function updateCondition(idx: number, patch: Partial<RuleCondition>) {
    setForm(f => ({ ...f, conditions: f.conditions.map((c, i) => i === idx ? { ...c, ...patch } : c) }))
  }

  function updateAction(idx: number, patch: Partial<RuleAction>) {
    setForm(f => ({ ...f, actions: f.actions.map((a, i) => i === idx ? { ...a, ...patch } : a) }))
  }

  const selectedTool = (tool: string) => TOOL_REGISTRY[tool]

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Automation Rules</h1>
          <p className="text-sm text-muted-foreground mt-1">React to events automatically — create tickets, send alerts, trigger healing</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90">
          <Plus className="w-4 h-4" /> Add Rule
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : rules.length === 0 ? (
        <div className="border border-dashed rounded-xl p-12 text-center text-muted-foreground">
          <Zap className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p className="text-lg font-medium">No rules yet</p>
          <p className="text-sm mt-1">Rules automatically react to Kafka events — create a Jira ticket when P1 fires, alert Slack on high CPU, etc.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {rules.map(rule => (
            <div key={rule.id} className="border rounded-xl bg-card overflow-hidden">
              <div className="flex items-center gap-3 p-4">
                <button onClick={() => setExpanded(expanded === rule.id ? null : rule.id)} className="p-1 text-muted-foreground hover:text-foreground">
                  {expanded === rule.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{rule.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{rule.topic} · fired {rule.fireCount}×{rule.lastFiredAt ? ` · last ${new Date(rule.lastFiredAt).toLocaleDateString()}` : ''}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${rule.enabled ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500'}`}>
                    {rule.enabled ? 'Active' : 'Paused'}
                  </span>
                  <button onClick={() => toggleRule(rule)} disabled={toggling === rule.id} className="text-muted-foreground hover:text-foreground p-1">
                    {toggling === rule.id ? <Loader2 className="w-5 h-5 animate-spin" /> : rule.enabled ? <ToggleRight className="w-5 h-5 text-green-500" /> : <ToggleLeft className="w-5 h-5" />}
                  </button>
                  <button onClick={() => deleteRule(rule.id)} disabled={deleting === rule.id} className="text-muted-foreground hover:text-red-500 p-1">
                    {deleting === rule.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {expanded === rule.id && (
                <div className="border-t px-4 py-3 text-sm space-y-3 bg-muted/30">
                  {rule.description && <p className="text-muted-foreground">{rule.description}</p>}
                  <div>
                    <div className="font-medium mb-1 text-xs uppercase tracking-wide text-muted-foreground">Conditions (ALL must match)</div>
                    <div className="space-y-1">
                      {rule.conditions.map((c, i) => (
                        <div key={i} className="font-mono text-xs bg-background border rounded px-2 py-1">
                          <span className="text-blue-500">{c.field}</span>
                          {' '}<span className="text-purple-500">{c.operator}</span>
                          {c.value !== undefined && <> <span className="text-green-600">"{String(c.value)}"</span></>}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="font-medium mb-1 text-xs uppercase tracking-wide text-muted-foreground">Actions</div>
                    <div className="space-y-1">
                      {rule.actions.map((a, i) => (
                        <div key={i} className="font-mono text-xs bg-background border rounded px-2 py-1">
                          <span className="text-orange-500">{a.tool}</span>.<span className="text-blue-500">{a.action}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Rule Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-background rounded-2xl shadow-2xl w-full max-w-2xl p-6 my-8">
            <h2 className="text-lg font-semibold mb-4">Create Automation Rule</h2>

            <div className="space-y-4">
              {/* Name & topic */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Rule Name <span className="text-red-500">*</span></label>
                  <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. P1 Alert → Jira Incident" className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Trigger Topic <span className="text-red-500">*</span></label>
                  <select value={form.topic} onChange={e => setForm(f => ({ ...f, topic: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm bg-background">
                    {ALL_TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Description</label>
                <input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What does this rule do?" className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
              </div>

              {/* Conditions */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Conditions <span className="text-muted-foreground font-normal">(ALL must match)</span></label>
                  <button onClick={() => setForm(f => ({ ...f, conditions: [...f.conditions, { ...BLANK_CONDITION }] }))} className="text-xs text-primary hover:underline">+ Add condition</button>
                </div>
                {form.conditions.map((cond, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <input type="text" value={cond.field} onChange={e => updateCondition(i, { field: e.target.value })} placeholder="field e.g. severity" className="flex-1 border rounded-lg px-3 py-1.5 text-sm font-mono bg-background" />
                    <select value={cond.operator} onChange={e => updateCondition(i, { operator: e.target.value as ConditionOperator })} className="border rounded-lg px-2 py-1.5 text-sm bg-background">
                      {OPERATORS.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
                    </select>
                    {!['exists', 'not_exists'].includes(cond.operator) && (
                      <input type="text" value={String(cond.value ?? '')} onChange={e => updateCondition(i, { value: e.target.value })} placeholder="value" className="flex-1 border rounded-lg px-3 py-1.5 text-sm bg-background" />
                    )}
                    {form.conditions.length > 1 && (
                      <button onClick={() => setForm(f => ({ ...f, conditions: f.conditions.filter((_, ci) => ci !== i) }))} className="text-red-400 hover:text-red-600 px-2">×</button>
                    )}
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Actions</label>
                  <button onClick={() => setForm(f => ({ ...f, actions: [...f.actions, { ...BLANK_ACTION }] }))} className="text-xs text-primary hover:underline">+ Add action</button>
                </div>
                {form.actions.map((action, i) => {
                  const tool = selectedTool(action.tool)
                  return (
                    <div key={i} className="border rounded-lg p-3 mb-2 space-y-2">
                      <div className="flex gap-2">
                        <select value={action.tool} onChange={e => updateAction(i, { tool: e.target.value, action: Object.keys(selectedTool(e.target.value)?.actions ?? {})[0] ?? '', params: {} })} className="flex-1 border rounded-lg px-2 py-1.5 text-sm bg-background">
                          {Object.values(TOOL_REGISTRY).map(t => <option key={t.type} value={t.type}>{t.name}</option>)}
                        </select>
                        <select value={action.action} onChange={e => updateAction(i, { action: e.target.value, params: {} })} className="flex-1 border rounded-lg px-2 py-1.5 text-sm bg-background">
                          {Object.keys(tool?.actions ?? {}).map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                        {form.actions.length > 1 && (
                          <button onClick={() => setForm(f => ({ ...f, actions: f.actions.filter((_, ai) => ai !== i) }))} className="text-red-400 hover:text-red-600 px-2">×</button>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Params JSON — use <code className="bg-muted px-1 rounded">{'{{event.fieldName}}'}</code> for event values
                      </div>
                      <textarea
                        rows={3}
                        value={JSON.stringify(action.params, null, 2)}
                        onChange={e => { try { updateAction(i, { params: JSON.parse(e.target.value) }) } catch {} }}
                        className="w-full border rounded-lg px-3 py-2 text-xs font-mono bg-background resize-none"
                      />
                    </div>
                  )
                })}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Cooldown (ms) <span className="text-muted-foreground font-normal">— min time between re-fires</span></label>
                <input type="number" value={form.cooldownMs} onChange={e => setForm(f => ({ ...f, cooldownMs: Number(e.target.value) }))} className="w-48 border rounded-lg px-3 py-2 text-sm bg-background" />
              </div>

              {saveError && <p className="text-sm text-red-500">{saveError}</p>}

              <div className="flex gap-3 pt-2">
                <button onClick={saveRule} disabled={saving || !form.name} className="flex-1 bg-primary text-primary-foreground py-2 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Save Rule'}
                </button>
                <button onClick={() => { setShowAdd(false); resetForm() }} className="flex-1 border py-2 rounded-lg text-sm font-medium hover:bg-muted">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
