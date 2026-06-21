'use client'

import { useEffect, useState, useCallback } from 'react'
import { Key, Plus, Trash2, Copy, Check, ToggleRight, ToggleLeft, Loader2, Shield, AlertTriangle } from 'lucide-react'

interface ApiKey {
  id: string; name: string; prefix: string; scopes: string[]
  active: boolean; lastUsedAt?: string; expiresAt?: string; createdAt: string
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', scopes: ['read', 'write'] as string[], expiresInDays: '' })
  const [creating, setCreating] = useState(false)
  const [newKey, setNewKey] = useState('')
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/apikeys')
    if (res.ok) setKeys(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function create() {
    if (!form.name.trim()) return
    setCreating(true)
    const res = await fetch('/api/apikeys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, expiresInDays: form.expiresInDays ? Number(form.expiresInDays) : undefined }),
    })
    if (res.ok) {
      const data = await res.json()
      setNewKey(data.key)
      setKeys(k => [data, ...k])
      setShowCreate(false)
      setForm({ name: '', scopes: ['read', 'write'], expiresInDays: '' })
    }
    setCreating(false)
  }

  async function toggle(key: ApiKey) {
    const res = await fetch(`/api/apikeys/${key.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !key.active }),
    })
    if (res.ok) setKeys(ks => ks.map(k => k.id === key.id ? { ...k, active: !k.active } : k))
  }

  async function deleteKey(id: string) {
    if (!confirm('Revoke this API key? This cannot be undone.')) return
    await fetch(`/api/apikeys/${id}`, { method: 'DELETE' })
    setKeys(ks => ks.filter(k => k.id !== id))
  }

  async function copy(text: string) {
    await navigator.clipboard.writeText(text).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function reltime(iso?: string) {
    if (!iso) return 'Never'
    const diff = Date.now() - new Date(iso).getTime()
    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return new Date(iso).toLocaleDateString()
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-white">
            <Key className="w-6 h-6 text-ardoura-400" /> API Keys
          </h1>
          <p className="text-sm text-slate-400 mt-1">Authenticate external access to the ArdouraAI API</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 bg-ardoura-600 hover:bg-ardoura-500 text-white text-sm px-4 py-2 rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> New Key
        </button>
      </div>

      {/* Newly created key — one-time display */}
      {newKey && (
        <div className="border border-yellow-700 bg-yellow-900/20 rounded-2xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-yellow-400" />
            <p className="text-sm font-semibold text-yellow-300">Save this key — it will not be shown again</p>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs font-mono bg-slate-900 rounded-lg px-3 py-2 text-yellow-200 break-all">{newKey}</code>
            <button onClick={() => copy(newKey)} className="flex items-center gap-1 text-xs border border-yellow-700 px-3 py-2 rounded-lg text-yellow-300 hover:bg-yellow-900/30 transition-colors flex-shrink-0">
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <button onClick={() => setNewKey('')} className="mt-2 text-xs text-yellow-600 hover:text-yellow-400">Dismiss</button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>
      ) : keys.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-slate-700 rounded-2xl">
          <Key className="w-10 h-10 mx-auto mb-3 text-slate-600" />
          <p className="text-slate-400">No API keys yet</p>
          <button onClick={() => setShowCreate(true)} className="mt-3 text-sm text-ardoura-400 hover:text-ardoura-300">Create one →</button>
        </div>
      ) : (
        <div className="border border-slate-800 rounded-2xl overflow-hidden">
          {keys.map((k, i) => (
            <div key={k.id} className={`p-4 flex items-center justify-between ${i < keys.length - 1 ? 'border-b border-slate-800' : ''} ${!k.active ? 'opacity-50' : ''}`}>
              <div className="flex items-center gap-3">
                <Shield className={`w-4 h-4 ${k.active ? 'text-green-400' : 'text-slate-600'}`} />
                <div>
                  <p className="text-sm font-medium text-white">{k.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <code className="text-xs text-slate-500 font-mono">{k.prefix}…</code>
                    <span className="text-slate-700">·</span>
                    {k.scopes.map(s => <span key={s} className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">{s}</span>)}
                    <span className="text-slate-700">·</span>
                    <span className="text-[10px] text-slate-500">Last used: {reltime(k.lastUsedAt)}</span>
                    {k.expiresAt && new Date(k.expiresAt) < new Date() && (
                      <span className="text-[10px] text-red-400">Expired</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => toggle(k)} className={`transition-colors ${k.active ? 'text-green-400 hover:text-slate-400' : 'text-slate-600 hover:text-green-400'}`}>
                  {k.active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                </button>
                <button onClick={() => deleteKey(k.id)} className="text-slate-600 hover:text-red-400 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-800">
              <h2 className="font-semibold text-white">New API Key</h2>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Production webhook" className="w-full border border-slate-700 rounded-lg px-3 py-2 text-sm bg-slate-800 text-white placeholder-slate-500" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-2 block">Scopes</label>
                <div className="flex gap-2 flex-wrap">
                  {['read', 'write', 'webhooks', 'admin'].map(s => (
                    <button
                      key={s}
                      onClick={() => setForm(f => ({
                        ...f,
                        scopes: f.scopes.includes(s) ? f.scopes.filter(x => x !== s) : [...f.scopes, s]
                      }))}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${form.scopes.includes(s) ? 'border-ardoura-500 bg-ardoura-900/40 text-ardoura-300' : 'border-slate-700 text-slate-400 hover:border-slate-600'}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Expires in days <span className="text-slate-600">(leave blank for no expiry)</span></label>
                <input type="number" value={form.expiresInDays} onChange={e => setForm(f => ({ ...f, expiresInDays: e.target.value }))} placeholder="30" className="w-full border border-slate-700 rounded-lg px-3 py-2 text-sm bg-slate-800 text-white placeholder-slate-500" />
              </div>
            </div>
            <div className="p-5 border-t border-slate-800 flex justify-end gap-2">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-white rounded-lg">Cancel</button>
              <button onClick={create} disabled={creating || !form.name} className="px-4 py-2 text-sm bg-ardoura-600 hover:bg-ardoura-500 disabled:opacity-50 text-white rounded-lg flex items-center gap-2">
                {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Create Key
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
