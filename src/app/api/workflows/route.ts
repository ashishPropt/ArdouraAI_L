import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'
import { logActivity } from '@/lib/activity'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId')

  const projects = await prisma.project.findMany({
    where: { userId: session.user.id },
    select: { id: true },
  })
  const projectIds = projects.map(p => p.id)

  const workflows = await prisma.workflow.findMany({
    where: { projectId: projectId ? projectId : { in: projectIds } },
    include: {
      steps: { orderBy: { stepOrder: 'asc' } },
      _count: { select: { runs: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(workflows)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { projectId, name, description, trigger, cronExpr, steps = [] } = body

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: session.user.id },
  })
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const workflow = await prisma.workflow.create({
    data: {
      projectId,
      name,
      description,
      trigger: trigger ?? 'MANUAL',
      cronExpr: trigger === 'CRON' ? cronExpr : null,
      webhookSecret: trigger === 'WEBHOOK' ? crypto.randomUUID() : null,
      steps: {
        create: steps.map((s: { name: string; type: string; config?: Record<string, unknown> }, idx: number) => ({
          name: s.name,
          stepOrder: idx,
          type: s.type,
          config: s.config ?? {},
        })),
      },
    },
    include: { steps: { orderBy: { stepOrder: 'asc' } } },
  })

  logActivity({ userId: session.user.id, projectId, action: 'workflow.created', entity: 'Workflow', entityId: workflow.id, metadata: { name } })

  return NextResponse.json(workflow, { status: 201 })
}
