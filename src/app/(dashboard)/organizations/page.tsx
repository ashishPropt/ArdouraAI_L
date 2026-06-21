'use client'

import { useEffect, useState, useCallback } from 'react'
import { Building2, Plus, Users, FolderOpen, Crown, Shield, User, Loader2, Trash2, ExternalLink } from 'lucide-react'
import Link from 'next/link'

type OrgPlan = 'FREE' | 'PRO' | 'ENTERPRISE'
type OrgRole = 'OWNER' | 'ADMIN' | 'MEMBER'

interface OrgData {
  id: string; name: string; slug: string; plan: OrgPlan; role: OrgRole
  createdAt: string; _count: { members: number; projects: number }
}

const PLAN_BADGE: Record<OrgPlan, string> = {
  FREE:       'bg-slate-700 text-slate-300',
  PRO:        'bg-blue-900/50 text-blue-300',
  ENTERPRISE: 'bg-purple-900/50 text-purple-300',
}
const ROLE_ICON: Record<OrgRole, React.ReactNode> = {
  OWNER:  <Crown className="w-3 h-3 text-yellow-400" />,
  ADMIN:  <Shield className="w-3 h-3 text-blue-400" />,
  MEMBER: <User className="w-3 h-3 text-slate-400" />,
}

export default function OrganizationsPage() {
  const [orgs, setOrgs] = useState<OrgData[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', slug: '' })
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/orgs')
    if (res.ok) setOrgs(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function slugify(s: string) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  }

  async function create() {
    if (!form.name.trim() || !form.slug.trim()) return
    setCreating(true); setError('')
    const res = await fetch('/api/orgs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Failed'); setCreating(false); return }
    setOrgs(o => [data, ...o])
    setShowCreate(false)
    setForm({ name: '', slug: '' })
    setCreating(false)
  }

  async function deleteOrg(org: OrgData) {
    if (!confirm(`Delete "${org.name}"? This cannot be undone.`)) return
    await fetch(`/api/orgs/${org.id}`, { method: 'DELETE' })
    setOrgs(o => o.filter(x => x.id !== org.id))
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-white">
            <Building2 className="w-6 h-6 text-ardoura-400" /> Organizations
          </h1>
          <p className="text-sm text-slate-400 mt-1">Manage teams and shared workspaces</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 bg-ardoura-600 hover:bg-ardoura-500 text-white text-sm px-4 py-2 rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> New Organization
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-slate-500" /></div>
      ) : orgs.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-slate-700 rounded-2xl">
          <Building2 className="w-12 h-12 mx-auto mb-3 text-slate-600" />
          <p className="text-slate-400 font-medium">No organizations yet</p>
          <p className="text-sm text-slate-500 mt-1">Create one to collaborate with your team</p>
          <button onClick={() => setShowCreate(true)} className="mt-4 text-sm text-ardoura-400 hover:text-ardoura-300">
            Create organization →
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {orgs.map(org => (
            <div key={org.id} className="border border-slate-800 rounded-2xl p-5 bg-card hover:border-slate-700 transition-colors group">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-ardoura-700 flex items-center justify-center text-lg font-bold text-white">
                    {org.name[0].toUpperCase()}
                  </div>
                  <div>
                    <h2 className="font-semibold text-white">{org.name}</h2>
                    <p className="text-xs text-slate-500 font-mono">{org.slug}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${PLAN_BADGE[org.plan]}`}>{org.plan}</span>
                  <span className="flex items-center gap-0.5">{ROLE_ICON[org.role]}</span>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs text-slate-500 mb-4">
                <span className="flex items-center gap-1"><Users className="w-3 h-3" />{org._count.members} member{org._count.members !== 1 ? 's' : ''}</span>
                <span className="flex items-center gap-1"><FolderOpen className="w-3 h-3" />{org._count.projects} project{org._count.projects !== 1 ? 's' : ''}</span>
              </div>

              <div className="flex gap-2">
                <Link href={`/organizations/${org.id}`} className="flex-1 flex items-center justify-center gap-1.5 border border-slate-700 hover:bg-slate-800 text-slate-300 text-sm py-1.5 rounded-lg transition-colors">
                  <ExternalLink className="w-3 h-3" /> Manage
                </Link>
                {org.role === 'OWNER' && (
                  <button onClick={() => deleteOrg(org)} className="px-3 py-1.5 border border-red-900/50 hover:bg-red-900/20 text-red-400 text-sm rounded-lg transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-800">
              <h2 className="text-lg font-semibold text-white">New Organization</h2>
            </div>
            <div className="p-5 space-y-4">
              {error && <p className="text-sm text-red-400 bg-red-900/20 rounded-lg px-3 py-2">{error}</p>}
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Organization Name *</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value, slug: slugify(e.target.value) }))}
                  placeholder="Acme Corp"
                  className="w-full border border-slate-700 rounded-lg px-3 py-2 text-sm bg-slate-800 text-white placeholder-slate-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Slug * <span className="text-slate-600">(URL-safe identifier)</span></label>
                <input
                  value={form.slug}
                  onChange={e => setForm(f => ({ ...f, slug: slugify(e.target.value) }))}
                  placeholder="acme-corp"
                  className="w-full border border-slate-700 rounded-lg px-3 py-2 text-sm bg-slate-800 text-white placeholder-slate-500 font-mono"
                />
              </div>
            </div>
            <div className="p-5 border-t border-slate-800 flex justify-end gap-2">
              <button onClick={() => { setShowCreate(false); setError('') }} className="px-4 py-2 text-sm text-slate-400 hover:text-white rounded-lg transition-colors">Cancel</button>
              <button onClick={create} disabled={creating || !form.name || !form.slug} className="px-4 py-2 text-sm bg-ardoura-600 hover:bg-ardoura-500 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center gap-2">
                {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
