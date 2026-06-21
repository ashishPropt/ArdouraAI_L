import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const projectId = searchParams.get('projectId') ?? undefined
  const days = parseInt(searchParams.get('days') ?? '30')
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const userId = session.user.id

  // Projects summary
  const projects = await prisma.project.findMany({
    where: { userId },
    include: { _count: { select: { files: true, messages: true } } },
    orderBy: { updatedAt: 'desc' },
  })

  // Incident stats by severity
  const incidentsBySeverity = await prisma.incident.groupBy({
    by: ['severity'],
    where: {
      project: { userId },
      ...(projectId ? { projectId } : {}),
      startedAt: { gte: since },
    },
    _count: { id: true },
  })

  // Incident stats by status
  const incidentsByStatus = await prisma.incident.groupBy({
    by: ['status'],
    where: {
      project: { userId },
      ...(projectId ? { projectId } : {}),
    },
    _count: { id: true },
  })

  // LLM cost by project
  const llmByProject = await prisma.lLMUsageLog.groupBy({
    by: ['projectId'],
    where: {
      userId,
      createdAt: { gte: since },
      ...(projectId ? { projectId } : {}),
    },
    _sum: { costUsd: true, inputTokens: true, outputTokens: true },
    _count: { id: true },
  })

  // LLM cost over time (daily buckets)
  const llmLogs = await prisma.lLMUsageLog.findMany({
    where: {
      userId,
      createdAt: { gte: since },
      ...(projectId ? { projectId } : {}),
    },
    select: { createdAt: true, costUsd: true, model: true, feature: true },
    orderBy: { createdAt: 'asc' },
  })

  // Bucket by day
  const dailyCost: Record<string, number> = {}
  for (const log of llmLogs) {
    const day = log.createdAt.toISOString().slice(0, 10)
    dailyCost[day] = (dailyCost[day] ?? 0) + log.costUsd
  }

  // Monitor uptime per project
  const monitorStats = await prisma.monitor.findMany({
    where: {
      project: { userId },
      ...(projectId ? { projectId } : {}),
    },
    include: {
      checks: {
        where: { checkedAt: { gte: since } },
        select: { status: true },
      },
    },
  })

  const uptimeByMonitor = monitorStats.map(m => {
    const total = m.checks.length
    const up = m.checks.filter(c => c.status === 'UP').length
    return {
      id: m.id,
      name: m.name,
      projectId: m.projectId,
      uptimePct: total > 0 ? Math.round((up / total) * 1000) / 10 : null,
      totalChecks: total,
    }
  })

  // Heal action stats
  const healStats = await prisma.healAction.groupBy({
    by: ['status'],
    where: {
      project: { userId },
      ...(projectId ? { projectId } : {}),
      createdAt: { gte: since },
    },
    _count: { id: true },
  })

  return NextResponse.json({
    projects: projects.map(p => ({
      id: p.id, name: p.name, status: p.status,
      fileCount: p._count.files, messageCount: p._count.messages,
      deployedUrl: p.deployedUrl, vultrIp: p.vultrIp,
      updatedAt: p.updatedAt,
    })),
    incidentsBySeverity,
    incidentsByStatus,
    llmByProject,
    dailyCost: Object.entries(dailyCost).map(([date, cost]) => ({ date, cost })),
    uptimeByMonitor,
    healStats,
    llmTotal: llmLogs.reduce((s, l) => s + l.costUsd, 0),
  })
}
