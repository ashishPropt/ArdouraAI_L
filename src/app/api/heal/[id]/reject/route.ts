import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'

type Params = { params: { id: string } }

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const action = await prisma.healAction.findUnique({ where: { id: params.id } })
  if (!action) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (action.status !== 'PENDING') return NextResponse.json({ error: `Cannot reject — status is ${action.status}` }, { status: 409 })

  if (action.projectId) {
    const project = await prisma.project.findFirst({ where: { id: action.projectId, userId: session.user.id } })
    if (!project) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { reason } = await req.json().catch(() => ({ reason: undefined }))

  await prisma.healAction.update({
    where: { id: params.id },
    data: { status: 'REJECTED', result: { rejectedBy: session.user.id, reason } as any },
  })

  return NextResponse.json({ rejected: true })
}
