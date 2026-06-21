import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'
import { encryptObject, decryptObject } from '@/lib/vault/encrypt'
import { executeTool } from '@/lib/mcp/executor'
import type { IntegrationType } from '@prisma/client'

type Params = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const integration = await prisma.integration.findFirst({
    where: { id: params.id, userId: session.user.id },
    select: { id: true, type: true, name: true, active: true, lastTestedAt: true, lastTestOk: true, createdAt: true },
  })
  if (!integration) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ integration })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await prisma.integration.findFirst({ where: { id: params.id, userId: session.user.id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const { name, config, active } = body as { name?: string; config?: Record<string, unknown>; active?: boolean }

  const data: Record<string, unknown> = {}
  if (name !== undefined) data.name = name
  if (active !== undefined) data.active = active
  if (config !== undefined) data.config = encryptObject(config)

  const updated = await prisma.integration.update({
    where: { id: params.id },
    data,
    select: { id: true, type: true, name: true, active: true, updatedAt: true },
  })

  return NextResponse.json({ integration: updated })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await prisma.integration.findFirst({ where: { id: params.id, userId: session.user.id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.integration.delete({ where: { id: params.id } })
  return NextResponse.json({ deleted: true })
}

// POST /api/integrations/:id/test
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const integration = await prisma.integration.findFirst({ where: { id: params.id, userId: session.user.id } })
  if (!integration) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const url = req.nextUrl.pathname
  if (!url.endsWith('/test')) {
    return NextResponse.json({ error: 'Use POST /api/integrations/:id/test to test' }, { status: 400 })
  }

  let config: Record<string, unknown>
  try {
    config = decryptObject<Record<string, unknown>>(integration.config)
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to decrypt config' })
  }

  // Run a lightweight read-only action to verify credentials
  const TEST_ACTIONS: Partial<Record<IntegrationType, { action: string; params: Record<string, unknown> }>> = {
    GITHUB:      { action: 'list_open_prs', params: { repo: (config.defaultRepo as string) ?? 'test' } },
    JIRA:        { action: 'search_issues', params: { jql: 'project IS NOT EMPTY ORDER BY created DESC', maxResults: 1 } },
    CONFLUENCE:  { action: 'search_pages', params: { query: 'test', limit: 1 } },
    SERVICENOW:  { action: 'search_issues' as any, params: {} },
    DATADOG:     { action: 'list_active_alerts', params: {} },
    DYNATRACE:   { action: 'get_problems', params: { status: 'OPEN' } },
    VULTR:       { action: 'list_instances', params: {} },
    SLACK:       { action: 'send_message', params: { text: 'ArdouraAI connection test ✓' } },
    DATABASE:    { action: 'check_connections', params: {} },
  }

  const testCall = TEST_ACTIONS[integration.type as IntegrationType]
  if (!testCall) {
    return NextResponse.json({ ok: false, error: 'No test action defined for this integration type' })
  }

  const result = await executeTool(
    { tool: integration.type as IntegrationType, action: testCall.action, params: testCall.params, integrationId: params.id },
    { projectId: 'test', bypassHITL: true }
  )

  await prisma.integration.update({
    where: { id: params.id },
    data: { lastTestedAt: new Date(), lastTestOk: result.success },
  })

  return NextResponse.json({ ok: result.success, error: result.error, data: result.data })
}
