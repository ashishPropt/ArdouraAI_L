import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'

type Params = { params: { id: string } }

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const env = await prisma.projectEnvironment.findUnique({
    where: { id: params.id },
    include: { project: { select: { userId: true } } },
  })
  if (!env || env.project.userId !== session.user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { name, deployedUrl, branch, active } = await req.json()
  const updated = await prisma.projectEnvironment.update({
    where: { id: params.id },
    data: { ...(name && { name }), ...(deployedUrl !== undefined && { deployedUrl }), ...(branch !== undefined && { branch }), ...(active !== undefined && { active }) },
  })
  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const env = await prisma.projectEnvironment.findUnique({
    where: { id: params.id },
    include: { project: { select: { userId: true } } },
  })
  if (!env || env.project.userId !== session.user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.projectEnvironment.delete({ where: { id: params.id } })
  return NextResponse.json({ deleted: true })
}
