import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'

type Params = { params: { id: string } }

async function getOrgWithRole(orgId: string, userId: string) {
  const member = await prisma.organizationMember.findUnique({
    where: { orgId_userId: { orgId, userId } },
    include: { org: { include: { _count: { select: { members: true, projects: true } } } } },
  })
  return member
}

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const m = await getOrgWithRole(params.id, session.user.id)
  if (!m) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ...m.org, role: m.role })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const m = await getOrgWithRole(params.id, session.user.id)
  if (!m || (m.role !== 'OWNER' && m.role !== 'ADMIN')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { name, logoUrl } = await req.json()
  const updated = await prisma.organization.update({
    where: { id: params.id },
    data: { ...(name && { name }), ...(logoUrl !== undefined && { logoUrl }) },
  })
  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const m = await getOrgWithRole(params.id, session.user.id)
  if (!m || m.role !== 'OWNER') return NextResponse.json({ error: 'Only owners can delete' }, { status: 403 })
  await prisma.organization.delete({ where: { id: params.id } })
  return NextResponse.json({ deleted: true })
}
