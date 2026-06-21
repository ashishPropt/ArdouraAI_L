import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const topic = searchParams.get('topic') ?? undefined
  const processed = searchParams.get('processed')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '100'), 500)

  const events = await prisma.kafkaEvent.findMany({
    where: {
      ...(topic ? { topic } : {}),
      ...(processed !== null ? { processed: processed === 'true' } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { id: true, topic: true, source: true, processed: true, error: true, createdAt: true, processedAt: true, payload: true },
  })

  // Stats
  const stats = await prisma.kafkaEvent.groupBy({
    by: ['topic'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 10,
  })

  return NextResponse.json({ events, stats })
}
