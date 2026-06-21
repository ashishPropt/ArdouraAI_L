import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const projectId = searchParams.get('projectId') ?? undefined

  const monitors = await prisma.monitor.findMany({
    where: {
      project: { userId: session.user.id },
      ...(projectId ? { projectId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    include: {
      checks: { orderBy: { checkedAt: 'desc' }, take: 30 },
      _count: { select: { incidents: true } },
    },
  })

  return NextResponse.json({ monitors })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { projectId, name, url, intervalSecs, timeoutSecs, method, expectedStatus } = body

  if (!projectId || !name || !url) {
    return NextResponse.json({ error: 'projectId, name, and url required' }, { status: 400 })
  }

  const project = await prisma.project.findFirst({ where: { id: projectId, userId: session.user.id } })
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const monitor = await prisma.monitor.create({
    data: {
      projectId,
      name,
      url,
      intervalSecs: intervalSecs ?? 60,
      timeoutSecs: timeoutSecs ?? 10,
      method: method ?? 'GET',
      expectedStatus: expectedStatus ?? 200,
      active: true,
    },
  })

  return NextResponse.json({ monitor }, { status: 201 })
}
