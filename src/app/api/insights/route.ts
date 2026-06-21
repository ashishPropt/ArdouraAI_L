import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId')

  const projects = await prisma.project.findMany({
    where: { userId: session.user.id },
    select: { id: true },
  })
  const ids = projects.map(p => p.id)

  const insights = await prisma.insight.findMany({
    where: { projectId: projectId ? projectId : { in: ids } },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { project: { select: { id: true, name: true } } },
  })

  return NextResponse.json(insights)
}
