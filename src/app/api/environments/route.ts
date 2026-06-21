import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'
import type { EnvType } from '@prisma/client'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const projectId = new URL(req.url).searchParams.get('projectId')
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 })

  const project = await prisma.project.findFirst({ where: { id: projectId, userId: session.user.id } })
  if (!project) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const envs = await prisma.projectEnvironment.findMany({
    where: { projectId },
    orderBy: { envType: 'asc' },
  })
  return NextResponse.json(envs)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectId, name, envType, deployedUrl, branch } = await req.json()
  if (!projectId || !envType) return NextResponse.json({ error: 'projectId and envType required' }, { status: 400 })

  const project = await prisma.project.findFirst({ where: { id: projectId, userId: session.user.id } })
  if (!project) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const env = await prisma.projectEnvironment.upsert({
    where: { projectId_envType: { projectId, envType } },
    create: { projectId, name: name ?? envType, envType, deployedUrl, branch },
    update: { name, deployedUrl, branch },
  })

  return NextResponse.json(env, { status: 201 })
}
