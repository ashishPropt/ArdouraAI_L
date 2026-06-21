'use client'

import { useEffect, useState } from 'react'
import { CreditCard, Check, Zap, Crown, Building2, Loader2, TrendingUp, AlertTriangle } from 'lucide-react'

type PlanId = 'FREE' | 'PRO' | 'ENTERPRISE'
interface PlanLimits { projects: number; monitorsPerProject: number; workflowRuns: number; llmBudgetUsd: number; teamMembers: number; insightsPerMonth: number; secretsPerProject: number; supportLevel: string }
interface Usage { projects: number; insightsThisMonth: number; llmSpendThisMonth: number; workflowRunsThisMonth: number }

const PLAN_ICON: Record<PlanId, React.ReactNode> = {
  FREE:       <Zap className="w-5 h-5 text-slate-400" />,
  PRO:        <Crown className="w-5 h-5 text-blue-400" />,
  ENTERPRISE: <Building2 className="w-5 h-5 text-purple-400" />,
}

const PLAN_COLOR: Record<PlanId, string> = {
  FREE:       'border-slate-700',
  PRO:        'border-blue-500 ring-1 ring-blue-500/30',
  ENTERPRISE: 'border-purple-500 ring-1 ring-purple-500/30',
}

function UsageBar({ label, used, limit, suffix = '' }: { label: string; used: number; limit: number; suffix?: string }) {
  const pct = limit === Infinity ? 0 : Math.min((used / limit) * 100, 100)
  const color = pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-yellow-500' : 'bg-ardoura-500'
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-400">{label}</span>
        <span className="text-slate-300">{used}{suffix} {limit !== Infinity ? `/ ${limit}${suffix}` : '(unlimited)'}</span>
      </div>
      {limit !== Infinity && (
        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  )
}

export default function BillingPage() {
  const [data, setData] = useState<{ plan: PlanId; limits: PlanLimits; usage: Usage; prices: Record<PlanId, { monthly: number }> } | null>(null)
  const [loading, setLoading] = useState(true)
  const [upgrading, setUpgrading] = useState<PlanId | null>(null)

  useEffect(() => {
    fetch('/api/billing/subscription').then(r => r.json()).then(d => { setData(d); setLoading(false) })
  }, [])

  async function upgrade(plan: PlanId) {
    if (plan === 'FREE') return
    setUpgrading(plan)
    const res = await fetch('/api/billing/subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    })
    const d = await res.json()
    if (d.error) alert(d.error)
    setUpgrading(null)
  }

  if (loading || !data) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-slate-500" /></div>

  const { plan, limits, usage, prices } = data

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <CreditCard className="w-6 h-6 text-ardoura-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Billing & Plan</h1>
          <p className="text-sm text-slate-400">Manage your subscription and usage</p>
        </div>
      </div>

      {/* Current plan banner */}
      <div className="border border-ardoura-700 rounded-2xl p-5 mb-8 bg-ardoura-900/20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {PLAN_ICON[plan]}
          <div>
            <p className="font-semibold text-white">Current Plan: <span className="text-ardoura-300">{plan}</span></p>
            <p className="text-xs text-slate-400">
              {plan === 'FREE' ? 'Upgrade to unlock more capacity' : `$${prices[plan]?.monthly}/mo · renews monthly`}
            </p>
          </div>
        </div>
        {plan === 'PRO' || plan === 'ENTERPRISE' ? (
          <span className="text-xs text-green-400 flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Active</span>
        ) : null}
      </div>

      {/* Usage meters */}
      <div className="border border-slate-800 rounded-2xl p-5 mb-8">
        <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-slate-400" /> This Month's Usage
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <UsageBar label="Projects" used={usage.projects} limit={limits.projects} />
          <UsageBar label="Workflow Runs" used={usage.workflowRunsThisMonth} limit={limits.workflowRuns} />
          <UsageBar label="AI Insights" used={usage.insightsThisMonth} limit={limits.insightsPerMonth} />
          <UsageBar label="LLM Spend" used={Number(usage.llmSpendThisMonth.toFixed(2))} limit={limits.llmBudgetUsd} suffix="$" />
        </div>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-3 gap-4">
        {(['FREE', 'PRO', 'ENTERPRISE'] as PlanId[]).map(p => {
          const isCurrent = p === plan
          const price = prices[p]?.monthly ?? 0
          const feats: [string, string][] = [
            ['Projects', PLAN_LIMITS_DISPLAY(p, 'projects')],
            ['Monitors/project', PLAN_LIMITS_DISPLAY(p, 'monitorsPerProject')],
            ['Workflow runs/mo', PLAN_LIMITS_DISPLAY(p, 'workflowRuns')],
            ['LLM budget/mo', `$${PLAN_LIMITS_DISPLAY(p, 'llmBudgetUsd')}`],
            ['Team members', PLAN_LIMITS_DISPLAY(p, 'teamMembers')],
            ['Support', p === 'FREE' ? 'Community' : p === 'PRO' ? 'Email 48h' : 'Dedicated SLA'],
          ]
          return (
            <div key={p} className={`border rounded-2xl p-5 flex flex-col ${PLAN_COLOR[p]} ${isCurrent ? 'bg-slate-800/40' : 'bg-card'}`}>
              <div className="flex items-center gap-2 mb-2">
                {PLAN_ICON[p]}
                <span className="font-semibold text-white">{p === 'FREE' ? 'Free' : p === 'PRO' ? 'Pro' : 'Enterprise'}</span>
                {isCurrent && <span className="ml-auto text-xs bg-ardoura-700 text-ardoura-200 px-1.5 py-0.5 rounded">Current</span>}
              </div>
              <p className="text-2xl font-bold text-white mb-4">
                {price === 0 ? '$0' : `$${price}`}<span className="text-sm font-normal text-slate-500">/mo</span>
              </p>
              <ul className="space-y-1.5 flex-1 mb-5">
                {feats.map(([label, val]) => (
                  <li key={label} className="flex items-center gap-2 text-xs text-slate-400">
                    <Check className="w-3 h-3 text-green-500 flex-shrink-0" />
                    <span><span className="text-white">{val}</span> {label}</span>
                  </li>
                ))}
              </ul>
              {!isCurrent && p !== 'FREE' && (
                <button onClick={() => upgrade(p)} disabled={!!upgrading} className="w-full bg-ardoura-600 hover:bg-ardoura-500 disabled:opacity-50 text-white text-sm py-2 rounded-lg transition-colors flex items-center justify-center gap-2">
                  {upgrading === p && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Upgrade to {p === 'PRO' ? 'Pro' : 'Enterprise'}
                </button>
              )}
              {!isCurrent && p === 'FREE' && (
                <p className="text-xs text-slate-600 text-center">Downgrade removes features</p>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-xs text-slate-600 text-center mt-6">
        Payments powered by Stripe · Set <code>STRIPE_SECRET_KEY</code> to enable checkout
      </p>
    </div>
  )
}

function PLAN_LIMITS_DISPLAY(plan: PlanId, key: string): string {
  const map: Record<PlanId, Record<string, number>> = {
    FREE:       { projects: 3, monitorsPerProject: 2, workflowRuns: 50, llmBudgetUsd: 2, teamMembers: 1 },
    PRO:        { projects: 25, monitorsPerProject: 20, workflowRuns: 2000, llmBudgetUsd: 50, teamMembers: 10 },
    ENTERPRISE: { projects: Infinity, monitorsPerProject: Infinity, workflowRuns: Infinity, llmBudgetUsd: Infinity, teamMembers: Infinity },
  }
  const v = map[plan][key]
  return v === Infinity ? '∞' : String(v)
}
