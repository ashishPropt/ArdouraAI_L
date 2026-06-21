import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'

type Params = { params: { id: string } }

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const key = await prisma.apiKey.findFirst({ where: { id: params.id, userId: session.user.id } })
  if (!key) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { active, name } = await req.json()
  const updated = await prisma.apiKey.update({
    where: { id: params.id },
    data: { ...(active !== undefined && { active }), ...(name && { name }) },
  })
  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const key = await prisma.apiKey.findFirst({ where: { id: params.id, userId: session.user.id } })
  if (!key) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.apiKey.delete({ where: { id: params.id } })
  return NextResponse.json({ deleted: true })
}
