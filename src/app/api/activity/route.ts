import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId')
  const limit = Math.min(Number(searchParams.get('limit') ?? '50'), 100)

  const projects = await prisma.project.findMany({
    where: { userId: session.user.id },
    select: { id: true },
  })
  const projectIds = projects.map(p => p.id)

  const logs = await prisma.activityLog.findMany({
    where: {
      OR: [
        { userId: session.user.id },
        { projectId: projectId ? projectId : { in: projectIds } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      project: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json(logs)
}
