import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'
import { encryptObject } from '@/lib/vault/encrypt'
import { TOOL_REGISTRY } from '@/lib/mcp/registry'
import type { IntegrationType } from '@prisma/client'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const integrations = await prisma.integration.findMany({
    where: { userId: session.user.id },
    select: { id: true, type: true, name: true, active: true, lastTestedAt: true, lastTestOk: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ integrations })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { type, name, config } = body as { type: string; name: string; config: Record<string, unknown> }

  if (!type || !name || !config) {
    return NextResponse.json({ error: 'type, name, and config are required' }, { status: 400 })
  }

  if (!TOOL_REGISTRY[type]) {
    return NextResponse.json({ error: `Unknown integration type: ${type}` }, { status: 400 })
  }

  const encryptedConfig = encryptObject(config)

  const integration = await prisma.integration.create({
    data: {
      userId: session.user.id,
      type: type as IntegrationType,
      name,
      config: encryptedConfig,
      active: true,
    },
    select: { id: true, type: true, name: true, active: true, createdAt: true },
  })

  return NextResponse.json({ integration }, { status: 201 })
}
