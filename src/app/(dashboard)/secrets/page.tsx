'use client'

import { useEffect, useState, useCallback } from 'react'
import { KeyRound, Plus, Trash2, Eye, EyeOff, Copy, Check, Loader2, Globe, GitBranch, Server } from 'lucide-react'

type EnvType = 'DEVELOPMENT' | 'STAGING' | 'PRODUCTION'

interface Project { id: string; name: string }
interface Secret { id: string; key: string; value: string; description?: string; envType: EnvType; updatedAt: string }
interface Environment { id: string; name: string; envType: EnvType; deployedUrl?: string; branch?: string; active: boolean }

const ENV_COLOR: Record<EnvType, string> = {
  DEVELOPMENT: 'bg-slate-700 text-slate-300',
  STAGING:     'bg-blue-900/50 text-blue-300',
  PRODUCTION:  'bg-green-900/50 text-green-300',
}

export default function SecretsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selProject, setSelProject] = useState('')
  const [selEnv, setSelEnv] = useState<EnvType>('PRODUCTION')
  const [secrets, setSecrets] = useState<Secret[]>([])
  const [envs, setEnvs] = useState<Environment[]>([])
  const [loading, setLoading] = useState(false)
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  const [copied, setCopied] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ key: '', value: '', description: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/projects').then(r => r.json()).then(ps => {
      setProjects(ps)
      if (ps.length > 0) setSelProject(ps[0].id)
    })
  }, [])

  const loadData = useCallback(async () => {
    if (!selProject) return
    setLoading(true)
    const [sRes, eRes] = await Promise.all([
      fetch(`/api/secrets?projectId=${selProject}&env=${selEnv}`),
      fetch(`/api/environments?projectId=${selProject}`),
    ])
    if (sRes.ok) setSecrets(await sRes.json())
    if (eRes.ok) setEnvs(await eRes.json())
    setLoading(false)
  }, [selProject, selEnv])

  useEffect(() => { loadData() }, [loadData])

  async function revealSecret(id: string) {
    if (revealed.has(id)) { setRevealed(r => { const n = new Set(r); n.delete(id); return n }); return }
    const res = await fetch(`/api/secrets/${id}`)
    if (res.ok) {
      const data = await res.json()
      setSecrets(s => s.map(x => x.id === id ? { ...x, value: data.value } : x))
      setRevealed(r => new Set(r).add(id))
    }
  }

  async function copySecret(id: string, value: string) {
    let v = value
    if (value === '••••••••') {
      const res = await fetch(`/api/secrets/${id}`)
      if (res.ok) { const d = await res.json(); v = d.value }
    }
    await navigator.clipboard.writeText(v).catch(() => {})
    setCopied(id)
    setTimeout(() => setCopied(''), 1500)
  }

  async function deleteSecret(id: string) {
    if (!confirm('Delete this secret?')) return
    await fetch(`/api/secrets/${id}`, { method: 'DELETE' })
    setSecrets(s => s.filter(x => x.id !== id))
  }

  async function addSecret() {
    if (!form.key || !form.value) return
    setSaving(true)
    const res = await fetch('/api/secrets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: selProject, envType: selEnv, ...form }),
    })
    if (res.ok) { await loadData(); setShowAdd(false); setForm({ key: '', value: '', description: '' }) }
    setSaving(false)
  }

  const selEnvData = envs.find(e => e.envType === selEnv)

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-white">
            <KeyRound className="w-6 h-6 text-ardoura-400" /> Secret Manager
          </h1>
          <p className="text-sm text-slate-400 mt-1">Encrypted per-project environment variables</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 bg-ardoura-600 hover:bg-ardoura-500 text-white text-sm px-4 py-2 rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> Add Secret
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <select value={selProject} onChange={e => setSelProject(e.target.value)} className="border border-slate-700 rounded-lg px-3 py-2 text-sm bg-slate-800 text-white">
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div className="flex rounded-lg overflow-hidden border border-slate-700">
          {(['DEVELOPMENT', 'STAGING', 'PRODUCTION'] as EnvType[]).map(env => (
            <button key={env} onClick={() => setSelEnv(env)} className={`px-4 py-2 text-sm transition-colors ${selEnv === env ? 'bg-ardoura-700 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
              {env.charAt(0) + env.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Environment info */}
      {selEnvData && (
        <div className="border border-slate-800 rounded-xl p-4 mb-6 flex items-center gap-6 text-sm">
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${ENV_COLOR[selEnv]}`}>{selEnv}</span>
          {selEnvData.deployedUrl && <span className="flex items-center gap-1.5 text-slate-400"><Globe className="w-3.5 h-3.5" />{selEnvData.deployedUrl}</span>}
          {selEnvData.branch && <span className="flex items-center gap-1.5 text-slate-400"><GitBranch className="w-3.5 h-3.5" />{selEnvData.branch}</span>}
        </div>
      )}

      {/* Secrets table */}
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>
      ) : secrets.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-slate-700 rounded-2xl">
          <KeyRound className="w-10 h-10 mx-auto mb-3 text-slate-600" />
          <p className="text-slate-400">No secrets for {selEnv.toLowerCase()}</p>
          <button onClick={() => setShowAdd(true)} className="mt-3 text-sm text-ardoura-400 hover:text-ardoura-300">Add first secret →</button>
        </div>
      ) : (
        <div className="border border-slate-800 rounded-2xl overflow-hidden">
          <div className="grid grid-cols-[1fr_2fr_1fr_auto] gap-0 text-xs font-medium text-slate-500 px-4 py-2 border-b border-slate-800 bg-slate-900">
            <span>KEY</span><span>VALUE</span><span>DESCRIPTION</span><span>ACTIONS</span>
          </div>
          {secrets.map(s => (
            <div key={s.id} className="grid grid-cols-[1fr_2fr_1fr_auto] items-center gap-2 px-4 py-3 border-b border-slate-800 hover:bg-slate-800/30 transition-colors">
              <span className="font-mono text-sm text-ardoura-300">{s.key}</span>
              <span className="font-mono text-sm text-slate-300 truncate">{revealed.has(s.id) ? s.value : '••••••••'}</span>
              <span className="text-xs text-slate-500 truncate">{s.description ?? '—'}</span>
              <div className="flex items-center gap-1">
                <button onClick={() => revealSecret(s.id)} className="p-1.5 text-slate-500 hover:text-white transition-colors" title={revealed.has(s.id) ? 'Hide' : 'Reveal'}>
                  {revealed.has(s.id) ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
                <button onClick={() => copySecret(s.id, s.value)} className="p-1.5 text-slate-500 hover:text-white transition-colors" title="Copy">
                  {copied === s.id ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                <button onClick={() => deleteSecret(s.id)} className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-800">
              <h2 className="font-semibold text-white">Add Secret <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${ENV_COLOR[selEnv]}`}>{selEnv}</span></h2>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Key *</label>
                <input value={form.key} onChange={e => setForm(f => ({ ...f, key: e.target.value.toUpperCase().replace(/\s/g, '_') }))} placeholder="DATABASE_URL" className="w-full border border-slate-700 rounded-lg px-3 py-2 text-sm bg-slate-800 text-white font-mono placeholder-slate-500" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Value *</label>
                <input type="password" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} placeholder="Enter secret value" className="w-full border border-slate-700 rounded-lg px-3 py-2 text-sm bg-slate-800 text-white placeholder-slate-500" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Description</label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional description" className="w-full border border-slate-700 rounded-lg px-3 py-2 text-sm bg-slate-800 text-white placeholder-slate-500" />
              </div>
            </div>
            <div className="p-5 border-t border-slate-800 flex justify-end gap-2">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-white rounded-lg">Cancel</button>
              <button onClick={addSecret} disabled={saving || !form.key || !form.value} className="px-4 py-2 text-sm bg-ardoura-600 hover:bg-ardoura-500 disabled:opacity-50 text-white rounded-lg flex items-center gap-2">
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
