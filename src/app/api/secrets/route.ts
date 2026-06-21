import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'
import { encryptObject, decryptObject } from '@/lib/vault/crypto'
import type { EnvType } from '@prisma/client'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId')
  const envType = (searchParams.get('env') ?? 'PRODUCTION') as EnvType

  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 })

  const project = await prisma.project.findFirst({ where: { id: projectId, userId: session.user.id } })
  if (!project) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const secrets = await prisma.projectSecret.findMany({
    where: { projectId, envType },
    orderBy: { key: 'asc' },
  })

  return NextResponse.json(secrets.map(s => ({ ...s, value: '••••••••' })))
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectId, envType = 'PRODUCTION', key, value, description } = await req.json()
  if (!projectId || !key || value === undefined) return NextResponse.json({ error: 'projectId, key, value required' }, { status: 400 })

  const project = await prisma.project.findFirst({ where: { id: projectId, userId: session.user.id } })
  if (!project) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const encrypted = encryptObject({ value })

  const secret = await prisma.projectSecret.upsert({
    where: { projectId_envType_key: { projectId, envType, key } },
    create: { projectId, envType, key, value: encrypted, description },
    update: { value: encrypted, description },
  })

  return NextResponse.json({ ...secret, value: '••••���•••' }, { status: 201 })
}
