import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'

type Params = { params: { id: string } }

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const me = await prisma.organizationMember.findUnique({
    where: { orgId_userId: { orgId: params.id, userId: session.user.id } },
  })
  if (!me || (me.role !== 'OWNER' && me.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { email, role = 'MEMBER' } = await req.json()
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })

  // Expire existing pending invite for this email
  await prisma.invitation.deleteMany({
    where: { orgId: params.id, email, acceptedAt: null },
  })

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
  const invite = await prisma.invitation.create({
    data: { orgId: params.id, email, role, expiresAt },
  })

  const base = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  const link = `${base}/invite/${invite.token}`

  return NextResponse.json({ invite, link })
}

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const me = await prisma.organizationMember.findUnique({
    where: { orgId_userId: { orgId: params.id, userId: session.user.id } },
  })
  if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const invites = await prisma.invitation.findMany({
    where: { orgId: params.id },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(invites)
}
