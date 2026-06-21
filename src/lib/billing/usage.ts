import { prisma } from '@/lib/db/prisma'
import { PLAN_LIMITS, type PlanId } from './plans'

export async function getUserPlan(userId: string): Promise<PlanId> {
  const sub = await prisma.subscription.findUnique({ where: { userId } })
  if (!sub || sub.status === 'CANCELLED') return 'FREE'
  return sub.plan as PlanId
}

export async function checkProjectLimit(userId: string): Promise<{ allowed: boolean; current: number; limit: number }> {
  const plan = await getUserPlan(userId)
  const limit = PLAN_LIMITS[plan].projects
  const current = await prisma.project.count({ where: { userId } })
  return { allowed: current < limit, current, limit }
}

export async function checkMonitorLimit(userId: string, projectId: string): Promise<{ allowed: boolean; current: number; limit: number }> {
  const plan = await getUserPlan(userId)
  const limit = PLAN_LIMITS[plan].monitorsPerProject
  const current = await prisma.monitor.count({ where: { projectId } })
  return { allowed: current < limit, current, limit }
}

export async function getMonthlyWorkflowRuns(userId: string): Promise<number> {
  const since = new Date()
  since.setDate(1); since.setHours(0, 0, 0, 0)

  const projects = await prisma.project.findMany({ where: { userId }, select: { id: true } })
  const projectIds = projects.map(p => p.id)

  const workflows = await prisma.workflow.findMany({ where: { projectId: { in: projectIds } }, select: { id: true } })
  const wfIds = workflows.map(w => w.id)

  return prisma.workflowRun.count({ where: { workflowId: { in: wfIds }, startedAt: { gte: since } } })
}

export async function getUserUsageSummary(userId: string) {
  const plan = await getUserPlan(userId)
  const limits = PLAN_LIMITS[plan]
  const since = new Date(); since.setDate(1); since.setHours(0, 0, 0, 0)

  const [projects, insights, llmCost, workflowRuns] = await Promise.all([
    prisma.project.count({ where: { userId } }),
    prisma.insight.count({ where: { userId, createdAt: { gte: since } } }),
    prisma.lLMUsageLog.aggregate({ where: { userId, createdAt: { gte: since } }, _sum: { costUsd: true } }),
    getMonthlyWorkflowRuns(userId),
  ])

  return {
    plan,
    limits,
    usage: {
      projects,
      insightsThisMonth: insights,
      llmSpendThisMonth: llmCost._sum.costUsd ?? 0,
      workflowRunsThisMonth: workflowRuns,
    },
  }
}
