import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const monitor = await prisma.monitor.findFirst({
    where: { id: params.id, project: { userId: session.user.id } },
  })
  if (!monitor) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { searchParams } = req.nextUrl
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '100'), 500)

  const checks = await prisma.monitorCheck.findMany({
    where: { monitorId: params.id },
    orderBy: { checkedAt: 'desc' },
    take: limit,
  })

  // Compute uptime % from these checks
  const up = checks.filter(c => c.status === 'UP').length
  const uptimePct = checks.length > 0 ? Math.round((up / checks.length) * 1000) / 10 : null

  return NextResponse.json({ checks, uptimePct, total: checks.length })
}
