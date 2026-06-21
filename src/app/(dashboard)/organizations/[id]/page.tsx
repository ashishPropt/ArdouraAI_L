'use client'

import { useEffect, useState, useCallback } from 'react'
import { use } from 'react'
import { Building2, Users, Crown, Shield, User, Loader2, Trash2, Mail, Copy, Check, UserPlus } from 'lucide-react'

type OrgRole = 'OWNER' | 'ADMIN' | 'MEMBER'
interface Member {
  id: string; role: OrgRole; joinedAt: string
  user: { id: string; name?: string; email?: string; image?: string }
}
interface Invite { id: string; email: string; role: OrgRole; expiresAt: string; acceptedAt?: string; token: string }
interface OrgDetail { id: string; name: string; slug: string; plan: string; _count: { members: number; projects: number } }

const ROLE_ICON: Record<OrgRole, React.ReactNode> = {
  OWNER:  <Crown className="w-3.5 h-3.5 text-yellow-400" />,
  ADMIN:  <Shield className="w-3.5 h-3.5 text-blue-400" />,
  MEMBER: <User className="w-3.5 h-3.5 text-slate-400" />,
}

export default function OrgDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [org, setOrg] = useState<OrgDetail | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<OrgRole>('MEMBER')
  const [inviting, setInviting] = useState(false)
  const [copiedLink, setCopiedLink] = useState('')
  const [myRole, setMyRole] = useState<OrgRole>('MEMBER')

  const load = useCallback(async () => {
    setLoading(true)
    const [oRes, mRes, iRes] = await Promise.all([
      fetch(`/api/orgs/${id}`),
      fetch(`/api/orgs/${id}/members`),
      fetch(`/api/orgs/${id}/invite`),
    ])
    if (oRes.ok) { const d = await oRes.json(); setOrg(d); setMyRole(d.role) }
    if (mRes.ok) setMembers(await mRes.json())
    if (iRes.ok) setInvites(await iRes.json())
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  async function sendInvite() {
    if (!inviteEmail.trim()) return
    setInviting(true)
    const res = await fetch(`/api/orgs/${id}/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
    })
    if (res.ok) {
      const data = await res.json()
      setInvites(i => [data.invite, ...i.filter(x => x.email !== inviteEmail)])
      await copyLink(data.link)
      setInviteEmail('')
    }
    setInviting(false)
  }

  async function copyLink(link: string) {
    await navigator.clipboard.writeText(link).catch(() => {})
    setCopiedLink(link)
    setTimeout(() => setCopiedLink(''), 2000)
  }

  async function removeMember(userId: string) {
    if (!confirm('Remove this member?')) return
    await fetch(`/api/orgs/${id}/members`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
    setMembers(m => m.filter(x => x.user.id !== userId))
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-slate-500" /></div>
  if (!org) return <div className="p-6 text-slate-400">Organization not found.</div>

  const canManage = myRole === 'OWNER' || myRole === 'ADMIN'

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-ardoura-700 flex items-center justify-center text-xl font-bold text-white">
          {org.name[0].toUpperCase()}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">{org.name}</h1>
          <p className="text-sm text-slate-500 font-mono">{org.slug} · {org.plan}</p>
        </div>
      </div>

      {/* Members */}
      <div className="border border-slate-800 rounded-2xl overflow-hidden mb-6">
        <div className="px-5 py-3 border-b border-slate-800 flex items-center gap-2">
          <Users className="w-4 h-4 text-slate-400" />
          <h2 className="font-semibold text-white text-sm">Members ({members.length})</h2>
        </div>
        <div className="divide-y divide-slate-800">
          {members.map(m => (
            <div key={m.id} className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-ardoura-800 flex items-center justify-center text-xs font-bold text-white">
                  {(m.user.name || m.user.email || '?')[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{m.user.name ?? m.user.email}</p>
                  {m.user.name && <p className="text-xs text-slate-500">{m.user.email}</p>}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-xs text-slate-400">{ROLE_ICON[m.role]} {m.role}</span>
                {canManage && m.role !== 'OWNER' && (
                  <button onClick={() => removeMember(m.user.id)} className="text-slate-600 hover:text-red-400 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Invite */}
      {canManage && (
        <div className="border border-slate-800 rounded-2xl overflow-hidden mb-6">
          <div className="px-5 py-3 border-b border-slate-800 flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-slate-400" />
            <h2 className="font-semibold text-white text-sm">Invite Member</h2>
          </div>
          <div className="p-5">
            <div className="flex gap-2">
              <input
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendInvite()}
                placeholder="colleague@company.com"
                className="flex-1 border border-slate-700 rounded-lg px-3 py-2 text-sm bg-slate-800 text-white placeholder-slate-500"
              />
              <select value={inviteRole} onChange={e => setInviteRole(e.target.value as OrgRole)} className="border border-slate-700 rounded-lg px-3 py-2 text-sm bg-slate-800 text-slate-300">
                <option value="MEMBER">Member</option>
                <option value="ADMIN">Admin</option>
              </select>
              <button onClick={sendInvite} disabled={inviting || !inviteEmail} className="flex items-center gap-1.5 bg-ardoura-600 hover:bg-ardoura-500 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition-colors">
                {inviting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                Invite
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pending Invites */}
      {invites.filter(i => !i.acceptedAt).length > 0 && (
        <div className="border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-800">
            <h2 className="font-semibold text-white text-sm">Pending Invitations</h2>
          </div>
          <div className="divide-y divide-slate-800">
            {invites.filter(i => !i.acceptedAt).map(inv => {
              const base = typeof window !== 'undefined' ? window.location.origin : ''
              const link = `${base}/invite/${inv.token}`
              const expired = new Date(inv.expiresAt) < new Date()
              return (
                <div key={inv.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm text-white">{inv.email}</p>
                    <p className="text-xs text-slate-500">{inv.role} · {expired ? <span className="text-red-400">Expired</span> : `Expires ${new Date(inv.expiresAt).toLocaleDateString()}`}</p>
                  </div>
                  <button onClick={() => copyLink(link)} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white border border-slate-700 px-3 py-1.5 rounded-lg transition-colors">
                    {copiedLink === link ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                    {copiedLink === link ? 'Copied' : 'Copy link'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
