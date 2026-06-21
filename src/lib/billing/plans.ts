export type PlanId = 'FREE' | 'PRO' | 'ENTERPRISE'

export interface PlanLimits {
  projects: number
  monitorsPerProject: number
  workflowRuns: number      // per month
  llmBudgetUsd: number      // per month
  teamMembers: number
  insightsPerMonth: number
  secretsPerProject: number
  supportLevel: string
}

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  FREE: {
    projects: 3,
    monitorsPerProject: 2,
    workflowRuns: 50,
    llmBudgetUsd: 2,
    teamMembers: 1,
    insightsPerMonth: 5,
    secretsPerProject: 10,
    supportLevel: 'Community',
  },
  PRO: {
    projects: 25,
    monitorsPerProject: 20,
    workflowRuns: 2000,
    llmBudgetUsd: 50,
    teamMembers: 10,
    insightsPerMonth: 100,
    secretsPerProject: 100,
    supportLevel: 'Email (48h)',
  },
  ENTERPRISE: {
    projects: Infinity,
    monitorsPerProject: Infinity,
    workflowRuns: Infinity,
    llmBudgetUsd: Infinity,
    teamMembers: Infinity,
    insightsPerMonth: Infinity,
    secretsPerProject: Infinity,
    supportLevel: 'Dedicated SLA',
  },
}

export const PLAN_PRICES: Record<PlanId, { monthly: number; annual: number; stripePriceId?: string }> = {
  FREE:       { monthly: 0,    annual: 0 },
  PRO:        { monthly: 49,   annual: 470,  stripePriceId: process.env.STRIPE_PRO_PRICE_ID },
  ENTERPRISE: { monthly: 299,  annual: 2990, stripePriceId: process.env.STRIPE_ENT_PRICE_ID },
}

export function getPlanLabel(plan: PlanId): string {
  return { FREE: 'Free', PRO: 'Pro', ENTERPRISE: 'Enterprise' }[plan]
}
