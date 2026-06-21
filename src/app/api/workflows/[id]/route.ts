import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'
import { logActivity } from '@/lib/activity'

type Params = { params: { id: string } }

async function getOwnedWorkflow(id: string, userId: string) {
  const workflow = await prisma.workflow.findUnique({
    where: { id },
    include: { project: { select: { userId: true } }, steps: { orderBy: { stepOrder: 'asc' } } },
  })
  if (!workflow || workflow.project.userId !== userId) return null
  return workflow
}

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const wf = await getOwnedWorkflow(params.id, session.user.id)
  if (!wf) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(wf)
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const wf = await getOwnedWorkflow(params.id, session.user.id)
  if (!wf) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const { name, description, trigger, cronExpr, active } = body

  const updated = await prisma.workflow.update({
    where: { id: params.id },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(trigger !== undefined && { trigger }),
      ...(cronExpr !== undefined && { cronExpr }),
      ...(active !== undefined && { active }),
    },
    include: { steps: { orderBy: { stepOrder: 'asc' } } },
  })

  logActivity({ userId: session.user.id, projectId: wf.projectId, action: 'workflow.updated', entity: 'Workflow', entityId: params.id })

  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const wf = await getOwnedWorkflow(params.id, session.user.id)
  if (!wf) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.workflow.delete({ where: { id: params.id } })
  logActivity({ userId: session.user.id, projectId: wf.projectId, action: 'workflow.deleted', entity: 'Workflow', entityId: params.id })

  return NextResponse.json({ deleted: true })
}
