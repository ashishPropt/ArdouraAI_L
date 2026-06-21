import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'
import { decryptObject } from '@/lib/vault/encrypt'

type Params = { params: { id: string } }

async function getOwnedSecret(id: string, userId: string) {
  const secret = await prisma.projectSecret.findUnique({
    where: { id },
    include: { project: { select: { userId: true } } },
  })
  if (!secret || secret.project.userId !== userId) return null
  return secret
}

export async function GET(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const secret = await getOwnedSecret(params.id, session.user.id)
  if (!secret) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { value } = decryptObject(secret.value) as { value: string }
  return NextResponse.json({ ...secret, value })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const secret = await getOwnedSecret(params.id, session.user.id)
  if (!secret) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.projectSecret.delete({ where: { id: params.id } })
  return NextResponse.json({ deleted: true })
}
