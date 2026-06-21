import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'
import type { ActionStatus } from '@prisma/client'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const statusRaw = searchParams.get('status')
  const status = statusRaw as ActionStatus | undefined
  const projectId = searchParams.get('projectId') ?? undefined

  const actions = await prisma.healAction.findMany({
    where: {
      ...(projectId
        ? { projectId }
        : { project: { userId: session.user.id } }),
      ...(status ? { status } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  return NextResponse.json({ actions })
}
