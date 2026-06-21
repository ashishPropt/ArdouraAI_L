import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'

type Params = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workflow = await prisma.workflow.findUnique({
    where: { id: params.id },
    include: { project: { select: { userId: true } } },
  })
  if (!workflow || workflow.project.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const runs = await prisma.workflowRun.findMany({
    where: { workflowId: params.id },
    orderBy: { startedAt: 'desc' },
    take: 20,
    include: { logs: { orderBy: { createdAt: 'asc' } } },
  })

  return NextResponse.json(runs)
}
