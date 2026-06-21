import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'
import { logActivity } from '@/lib/activity'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const memberships = await prisma.organizationMember.findMany({
    where: { userId: session.user.id },
    include: {
      org: {
        include: {
          _count: { select: { members: true, projects: true } },
        },
      },
    },
    orderBy: { joinedAt: 'asc' },
  })

  return NextResponse.json(memberships.map(m => ({ ...m.org, role: m.role })))
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, slug } = await req.json()
  if (!name?.trim() || !slug?.trim()) return NextResponse.json({ error: 'name and slug required' }, { status: 400 })

  const exists = await prisma.organization.findUnique({ where: { slug } })
  if (exists) return NextResponse.json({ error: 'Slug already taken' }, { status: 409 })

  const org = await prisma.organization.create({
    data: {
      name,
      slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      members: { create: { userId: session.user.id, role: 'OWNER' } },
    },
    include: { _count: { select: { members: true, projects: true } } },
  })

  logActivity({ userId: session.user.id, action: 'org.created', entity: 'Organization', entityId: org.id, metadata: { name } })

  return NextResponse.json({ ...org, role: 'OWNER' }, { status: 201 })
}
