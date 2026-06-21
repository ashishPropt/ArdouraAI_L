import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

// Public — no auth. Returns only safe, non-sensitive data.
export async function GET(req: NextRequest, { params }: { params: { projectId: string } }) {
  const project = await prisma.project.findUnique({
    where: { id: params.projectId },
    select: { id: true, name: true, deployedUrl: true, status: true },
  })

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const since90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)

  const monitors = await prisma.monitor.findMany({
    where: { projectId: params.projectId, active: true },
    select: {
      id: true, name: true, url: true, lastStatus: true, lastCheckedAt: true,
      checks: {
        where: { checkedAt: { gte: since90 } },
        select: { status: true, checkedAt: true },
        orderBy: { checkedAt: 'desc' },
        take: 90,
      },
    },
  })

  const incidents = await prisma.incident.findMany({
    where: { projectId: params.projectId },
    orderBy: { startedAt: 'desc' },
    take: 10,
    select: {
      id: true, title: true, severity: true, status: true,
      source: true, startedAt: true, resolvedAt: true, resolution: true,
    },
  })

  const monitorsSummary = monitors.map(m => {
    const total = m.checks.length
    const up = m.checks.filter(c => c.status === 'UP').length
    return {
      id: m.id,
      name: m.name,
      lastStatus: m.lastStatus,
      lastCheckedAt: m.lastCheckedAt,
      uptimePct: total > 0 ? Math.round((up / total) * 1000) / 10 : null,
      recentChecks: m.checks.slice(0, 30).map(c => ({ status: c.status, checkedAt: c.checkedAt })),
    }
  })

  // Overall status
  const hasDown = monitors.some(m => m.lastStatus === 'DOWN')
  const hasDegraded = monitors.some(m => m.lastStatus === 'DEGRADED')
  const overallStatus = hasDown ? 'outage' : hasDegraded ? 'degraded' : monitors.length > 0 ? 'operational' : 'unknown'

  return NextResponse.json({
    project: { id: project.id, name: project.name, deployedUrl: project.deployedUrl },
    overallStatus,
    monitors: monitorsSummary,
    incidents,
    generatedAt: new Date().toISOString(),
  })
}
