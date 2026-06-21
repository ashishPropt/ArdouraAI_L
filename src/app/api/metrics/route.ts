import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

// Prometheus-compatible text format
function gauge(name: string, value: number, labels: Record<string, string> = {}): string {
  const lStr = Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(',')
  return `${name}${lStr ? `{${lStr}}` : ''} ${value}`
}

export async function GET() {
  const [
    projectCount,
    userCount,
    incidentOpen,
    monitorUp,
    monitorDown,
    workflowCount,
    llmCost,
  ] = await Promise.all([
    prisma.project.count(),
    prisma.user.count(),
    prisma.incident.count({ where: { status: 'OPEN' } }),
    prisma.monitor.count({ where: { lastStatus: 'UP', active: true } }),
    prisma.monitor.count({ where: { lastStatus: 'DOWN', active: true } }),
    prisma.workflow.count({ where: { active: true } }),
    prisma.lLMUsageLog.aggregate({
      where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      _sum: { costUsd: true },
    }),
  ])

  const lines = [
    '# HELP ardoura_projects_total Total projects',
    '# TYPE ardoura_projects_total gauge',
    gauge('ardoura_projects_total', projectCount),
    '# HELP ardoura_users_total Total registered users',
    '# TYPE ardoura_users_total gauge',
    gauge('ardoura_users_total', userCount),
    '# HELP ardoura_incidents_open Open incidents',
    '# TYPE ardoura_incidents_open gauge',
    gauge('ardoura_incidents_open', incidentOpen),
    '# HELP ardoura_monitors_status Monitor status counts',
    '# TYPE ardoura_monitors_status gauge',
    gauge('ardoura_monitors_status', monitorUp,   { status: 'up' }),
    gauge('ardoura_monitors_status', monitorDown,  { status: 'down' }),
    '# HELP ardoura_workflows_active Active workflows',
    '# TYPE ardoura_workflows_active gauge',
    gauge('ardoura_workflows_active', workflowCount),
    '# HELP ardoura_llm_cost_usd_24h LLM cost last 24h',
    '# TYPE ardoura_llm_cost_usd_24h gauge',
    gauge('ardoura_llm_cost_usd_24h', llmCost._sum.costUsd ?? 0),
    '',
  ]

  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; version=0.0.4', 'Cache-Control': 'no-store' },
  })
}
