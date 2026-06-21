import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'
import type { RuleDefinition } from '@/lib/rules/types'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const projectId = searchParams.get('projectId') ?? undefined

  const rules = await prisma.rule.findMany({
    where: {
      userId: session.user.id,
      ...(projectId ? { projectId } : {}),
    },
    orderBy: { priority: 'asc' },
  })

  return NextResponse.json({ rules })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as Partial<RuleDefinition> & { projectId?: string }

  if (!body.name || !body.topic || !body.conditions || !body.actions) {
    return NextResponse.json({ error: 'name, topic, conditions, and actions are required' }, { status: 400 })
  }

  const rule = await prisma.rule.create({
    data: {
      userId: session.user.id,
      projectId: body.projectId,
      name: body.name,
      description: body.description,
      topic: body.topic,
      conditions: body.conditions as any,
      actions: body.actions as any,
      enabled: body.enabled ?? true,
      cooldownMs: body.cooldownMs,
      priority: 100,
      fireCount: 0,
    },
  })

  return NextResponse.json({ rule }, { status: 201 })
}
