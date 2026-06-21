import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const days = parseInt(searchParams.get('days') ?? '30')
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const [logs, byModel, totalCost] = await Promise.all([
    prisma.lLMUsageLog.findMany({
      where: { userId: session.user.id, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    prisma.lLMUsageLog.groupBy({
      by: ['model'],
      where: { userId: session.user.id, createdAt: { gte: since } },
      _sum: { inputTokens: true, outputTokens: true, costUsd: true },
      _count: { id: true },
      orderBy: { _sum: { costUsd: 'desc' } },
    }),
    prisma.lLMUsageLog.aggregate({
      where: { userId: session.user.id, createdAt: { gte: since } },
      _sum: { costUsd: true, inputTokens: true, outputTokens: true },
      _count: { id: true },
    }),
  ])

  return NextResponse.json({ logs, byModel, totals: totalCost._sum, callCount: totalCost._count.id })
}
