import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'

type Params = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const me = await prisma.organizationMember.findUnique({
    where: { orgId_userId: { orgId: params.id, userId: session.user.id } },
  })
  if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const members = await prisma.organizationMember.findMany({
    where: { orgId: params.id },
    include: { user: { select: { id: true, name: true, email: true, image: true } } },
    orderBy: { joinedAt: 'asc' },
  })
  return NextResponse.json(members)
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const me = await prisma.organizationMember.findUnique({
    where: { orgId_userId: { orgId: params.id, userId: session.user.id } },
  })
  if (!me || (me.role !== 'OWNER' && me.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { userId } = await req.json()
  if (userId === session.user.id) return NextResponse.json({ error: 'Cannot remove yourself' }, { status: 400 })

  await prisma.organizationMember.deleteMany({ where: { orgId: params.id, userId } })
  return NextResponse.json({ removed: true })
}
