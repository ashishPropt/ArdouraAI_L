import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'

type Params = { params: { id: string } }

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await prisma.incident.findFirst({
    where: { id: params.id, project: { userId: session.user.id } },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { status, rootCause, externalRef } = await req.json()

  const updated = await prisma.incident.update({
    where: { id: params.id },
    data: {
      ...(status && { status }),
      ...(rootCause && { rootCause }),
      ...(externalRef && { externalRef }),
      ...(status === 'RESOLVED' && { resolvedAt: new Date() }),
    },
  })

  return NextResponse.json({ incident: updated })
}
