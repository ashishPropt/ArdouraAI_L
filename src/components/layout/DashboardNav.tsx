'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { Cpu, LayoutGrid, Settings, LogOut, Plus, Plug, Zap, Activity, AlertTriangle, Server, Coins, BarChart2, Globe, Workflow, ListChecks, Building2, Brain, KeyRound, CreditCard, Key, Megaphone } from 'lucide-react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  user: { name?: string | null; email?: string | null; image?: string | null }
}

export function DashboardNav({ user }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [creating, setCreating] = useState(false)

  async function createProject() {
    const name = prompt('Project name?')
    if (!name) return
    setCreating(true)
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    const project = await res.json()
    setCreating(false)
    router.push(`/project/${project.id}`)
  }

  return (
    <aside className="w-60 flex flex-col bg-slate-900 border-r border-slate-800 h-full">
      {/* Logo */}
      <div className="p-4 border-b border-slate-800">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-ardoura-500 rounded-lg flex items-center justify-center">
            <Cpu className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-white tracking-tight">ArdouraAI</span>
        </Link>
      </div>

      {/* New project button */}
      <div className="p-3">
        <button
          onClick={createProject}
          disabled={creating}
          className="w-full flex items-center gap-2 bg-ardoura-600 hover:bg-ardoura-500 disabled:opacity-50 text-white text-sm px-3 py-2 rounded-lg transition-colors font-medium"
        >
          <Plus className="w-4 h-4" />
          New project
        </button>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 space-y-1">
        {[
          { href: '/',               icon: LayoutGrid,    label: 'Projects' },
          { href: '/integrations',   icon: Plug,          label: 'Integrations' },
          { href: '/rules',          icon: Zap,           label: 'Automation Rules' },
          { href: '/incidents',      icon: AlertTriangle, label: 'Incidents' },
          { href: '/monitors',       icon: Globe,         label: 'Monitors' },
          { href: '/workflows',      icon: Workflow,      label: 'Workflows' },
          { href: '/observability',  icon: Activity,      label: 'Observability' },
          { href: '/analytics',      icon: BarChart2,     label: 'Analytics' },
          { href: '/activity',       icon: ListChecks,    label: 'Activity' },
          { href: '/insights',       icon: Brain,         label: 'AI Insights' },
          { href: '/secrets',        icon: KeyRound,      label: 'Secrets' },
          { href: '/marketing',      icon: Megaphone,     label: 'Marketing' },
          { href: '/api-keys',       icon: Key,           label: 'API Keys' },
          { href: '/billing',        icon: CreditCard,    label: 'Billing' },
          { href: '/organizations',  icon: Building2,     label: 'Organizations' },
          { href: '/cloud',          icon: Server,        label: 'Cloud Manager' },
          { href: '/tokens',         icon: Coins,         label: 'Token Usage' },
          { href: '/settings',       icon: Settings,      label: 'Settings' },
        ].map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
              pathname === href || pathname.startsWith(href + '/')
                ? 'bg-ardoura-800/50 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </Link>
        ))}
      </nav>

      {/* User footer */}
      <div className="p-3 border-t border-slate-800">
        <div className="flex items-center gap-2 px-2 py-1.5 mb-1">
          <div className="w-7 h-7 bg-ardoura-700 rounded-full flex items-center justify-center text-xs font-bold">
            {(user.name || user.email || 'U')[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate">{user.name || 'User'}</p>
            <p className="text-xs text-slate-500 truncate">{user.email}</p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full flex items-center gap-2 px-3 py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg text-sm transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
