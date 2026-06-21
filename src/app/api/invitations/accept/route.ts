import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { token } = await req.json()
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })

  const invite = await prisma.invitation.findUnique({ where: { token } })
  if (!invite) return NextResponse.json({ error: 'Invalid invitation' }, { status: 404 })
  if (invite.acceptedAt) return NextResponse.json({ error: 'Already accepted' }, { status: 409 })
  if (invite.expiresAt < new Date()) return NextResponse.json({ error: 'Invitation expired' }, { status: 410 })

  // Check if already a member
  const existing = await prisma.organizationMember.findUnique({
    where: { orgId_userId: { orgId: invite.orgId, userId: session.user.id } },
  })
  if (existing) return NextResponse.json({ error: 'Already a member', orgId: invite.orgId }, { status: 409 })

  await prisma.$transaction([
    prisma.organizationMember.create({
      data: { orgId: invite.orgId, userId: session.user.id, role: invite.role },
    }),
    prisma.invitation.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    }),
  ])

  return NextResponse.json({ orgId: invite.orgId, joined: true })
}
