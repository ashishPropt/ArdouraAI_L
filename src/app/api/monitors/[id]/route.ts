import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const monitor = await prisma.monitor.findFirst({
    where: { id: params.id, project: { userId: session.user.id } },
  })
  if (!monitor) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updated = await prisma.monitor.update({
    where: { id: params.id },
    data: {
      name: body.name ?? monitor.name,
      url: body.url ?? monitor.url,
      intervalSecs: body.intervalSecs ?? monitor.intervalSecs,
      timeoutSecs: body.timeoutSecs ?? monitor.timeoutSecs,
      method: body.method ?? monitor.method,
      expectedStatus: body.expectedStatus ?? monitor.expectedStatus,
      active: body.active ?? monitor.active,
    },
  })

  return NextResponse.json({ monitor: updated })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const monitor = await prisma.monitor.findFirst({
    where: { id: params.id, project: { userId: session.user.id } },
  })
  if (!monitor) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.monitor.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
