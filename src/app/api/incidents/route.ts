import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const projectId = searchParams.get('projectId') ?? undefined
  const status = searchParams.get('status') ?? undefined
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200)

  const incidents = await prisma.incident.findMany({
    where: {
      project: { userId: session.user.id },
      ...(projectId ? { projectId } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: { startedAt: 'desc' },
    take: limit,
    include: {
      healActions: {
        select: { id: true, title: true, status: true, riskLevel: true },
        orderBy: { startedAt: 'desc' },
        take: 5,
      },
    },
  })

  return NextResponse.json({ incidents })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { projectId, title, severity, source, externalRef, rootCause } = body

  if (!projectId || !title) return NextResponse.json({ error: 'projectId and title required' }, { status: 400 })

  const project = await prisma.project.findFirst({ where: { id: projectId, userId: session.user.id } })
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const incident = await prisma.incident.create({
    data: { projectId, title, severity: severity ?? 'P2', source: source ?? 'MANUAL', externalRef, rootCause, status: 'OPEN' },
  })

  return NextResponse.json({ incident }, { status: 201 })
}
