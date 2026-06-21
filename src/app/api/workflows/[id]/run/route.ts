import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'
import { executeWorkflow } from '@/lib/workflows/executor'
import { logActivity } from '@/lib/activity'

type Params = { params: { id: string } }

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workflow = await prisma.workflow.findUnique({
    where: { id: params.id },
    include: { project: { select: { userId: true } } },
  })
  if (!workflow || workflow.project.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const body = await req.json().catch(() => ({}))
  const input = (body.input as Record<string, unknown>) ?? {}

  const runId = await executeWorkflow(params.id, session.user.id, input)

  logActivity({
    userId: session.user.id,
    projectId: workflow.projectId,
    action: 'workflow.run',
    entity: 'WorkflowRun',
    entityId: runId,
    metadata: { workflowName: workflow.name },
  })

  const run = await prisma.workflowRun.findUnique({
    where: { id: runId },
    include: { logs: { orderBy: { createdAt: 'asc' } } },
  })

  return NextResponse.json(run)
}
