'use client'

import { useEffect, useState } from 'react'
import { Plus, CheckCircle, XCircle, Loader2, Trash2, TestTube } from 'lucide-react'
import { TOOL_REGISTRY } from '@/lib/mcp/registry'
import type { IntegrationType } from '@prisma/client'

interface Integration {
  id: string
  type: string
  name: string
  active: boolean
  lastTestedAt?: string
  lastTestOk?: boolean
  createdAt: string
}

const TOOL_ICONS: Record<string, string> = {
  GITHUB: '🐙', JIRA: '🔵', CONFLUENCE: '📄', SERVICENOW: '🔧',
  DATADOG: '🐕', DYNATRACE: '🦋', VULTR: '☁️', SLACK: '💬', DATABASE: '🗄️',
}

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [testing, setTesting] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const [form, setForm] = useState<{ type: string; name: string; config: Record<string, string> }>({
    type: 'GITHUB', name: '', config: {},
  })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => { fetchIntegrations() }, [])

  async function fetchIntegrations() {
    setLoading(true)
    const res = await fetch('/api/integrations')
    if (res.ok) {
      const data = await res.json()
      setIntegrations(data.integrations)
    }
    setLoading(false)
  }

  async function testIntegration(id: string) {
    setTesting(id)
    await fetch(`/api/integrations/${id}/test`, { method: 'POST' })
    await fetchIntegrations()
    setTesting(null)
  }

  async function deleteIntegration(id: string) {
    if (!confirm('Delete this integration?')) return
    setDeleting(id)
    await fetch(`/api/integrations/${id}`, { method: 'DELETE' })
    setIntegrations(prev => prev.filter(i => i.id !== id))
    setDeleting(null)
  }

  async function saveIntegration() {
    setSaving(true)
    setSaveError('')
    const res = await fetch('/api/integrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: form.type, name: form.name, config: form.config }),
    })
    if (!res.ok) {
      const err = await res.json()
      setSaveError(err.error ?? 'Failed to save')
    } else {
      setShowAdd(false)
      setForm({ type: 'GITHUB', name: '', config: {} })
      await fetchIntegrations()
    }
    setSaving(false)
  }

  const toolDef = TOOL_REGISTRY[form.type]

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Integrations</h1>
          <p className="text-sm text-muted-foreground mt-1">Connect your tools — GitHub, Jira, DataDog, Vultr and more</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90"
        >
          <Plus className="w-4 h-4" /> Add Integration
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : integrations.length === 0 ? (
        <div className="border border-dashed rounded-xl p-12 text-center text-muted-foreground">
          <p className="text-lg font-medium">No integrations yet</p>
          <p className="text-sm mt-1">Add your first integration to start automating SRE workflows</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {integrations.map(integration => (
            <div key={integration.id} className="border rounded-xl p-4 flex items-center justify-between bg-card">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{TOOL_ICONS[integration.type] ?? '🔌'}</span>
                <div>
                  <div className="font-medium">{integration.name}</div>
                  <div className="text-xs text-muted-foreground">{integration.type}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {integration.lastTestedAt && (
                  <span className="flex items-center gap-1 text-xs">
                    {integration.lastTestOk
                      ? <CheckCircle className="w-4 h-4 text-green-500" />
                      : <XCircle className="w-4 h-4 text-red-500" />}
                    <span className="text-muted-foreground">
                      {new Date(integration.lastTestedAt).toLocaleDateString()}
                    </span>
                  </span>
                )}
                <span className={`text-xs px-2 py-0.5 rounded-full ${integration.active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500'}`}>
                  {integration.active ? 'Active' : 'Inactive'}
                </span>
                <button
                  onClick={() => testIntegration(integration.id)}
                  disabled={testing === integration.id}
                  className="p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors"
                  title="Test connection"
                >
                  {testing === integration.id
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <TestTube className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => deleteIntegration(integration.id)}
                  disabled={deleting === integration.id}
                  className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md text-muted-foreground hover:text-red-500 transition-colors"
                  title="Delete"
                >
                  {deleting === integration.id
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Trash2 className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Integration Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Add Integration</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Tool Type</label>
                <select
                  value={form.type}
                  onChange={e => setForm(f => ({ ...f, type: e.target.value, config: {} }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
                >
                  {Object.values(TOOL_REGISTRY).map(t => (
                    <option key={t.type} value={t.type}>{TOOL_ICONS[t.type]} {t.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Display Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder={`e.g. Production ${toolDef?.name}`}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
                />
              </div>

              {toolDef && Object.entries(toolDef.configSchema).map(([key, schema]) => (
                <div key={key}>
                  <label className="block text-sm font-medium mb-1.5">
                    {key} {schema.required && <span className="text-red-500">*</span>}
                    <span className="font-normal text-muted-foreground ml-1">— {schema.description}</span>
                  </label>
                  <input
                    type={schema.secret ? 'password' : 'text'}
                    value={form.config[key] ?? ''}
                    onChange={e => setForm(f => ({ ...f, config: { ...f.config, [key]: e.target.value } }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background font-mono"
                    placeholder={schema.secret ? '••••••••' : key}
                  />
                </div>
              ))}

              {saveError && <p className="text-sm text-red-500">{saveError}</p>}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={saveIntegration}
                  disabled={saving || !form.name}
                  className="flex-1 bg-primary text-primary-foreground py-2 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Save Integration'}
                </button>
                <button
                  onClick={() => { setShowAdd(false); setSaveError('') }}
                  className="flex-1 border py-2 rounded-lg text-sm font-medium hover:bg-muted"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
