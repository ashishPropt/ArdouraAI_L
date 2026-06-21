import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'

type Params = { params: { id: string } }

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await prisma.rule.findFirst({ where: { id: params.id, userId: session.user.id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const { name, description, topic, conditions, actions, enabled, cooldownMs, priority } = body

  const rule = await prisma.rule.update({
    where: { id: params.id },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(topic !== undefined && { topic }),
      ...(conditions !== undefined && { conditions }),
      ...(actions !== undefined && { actions }),
      ...(enabled !== undefined && { enabled }),
      ...(cooldownMs !== undefined && { cooldownMs }),
      ...(priority !== undefined && { priority }),
    },
  })

  return NextResponse.json({ rule })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await prisma.rule.findFirst({ where: { id: params.id, userId: session.user.id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.rule.delete({ where: { id: params.id } })
  return NextResponse.json({ deleted: true })
}
