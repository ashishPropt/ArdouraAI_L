import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'
import { decryptObject } from '@/lib/vault/encrypt'
import { executeTool } from '@/lib/mcp/executor'
import type { IntegrationType } from '@prisma/client'

const TEST_ACTIONS: Partial<Record<IntegrationType, { action: string; params: Record<string, unknown> }>> = {
  GITHUB:     { action: 'list_open_prs', params: { repo: '_test_' } },
  JIRA:       { action: 'search_issues', params: { jql: 'project IS NOT EMPTY ORDER BY created DESC', maxResults: 1 } },
  CONFLUENCE: { action: 'search_pages', params: { query: 'test', limit: 1 } },
  DATADOG:    { action: 'list_active_alerts', params: {} },
  DYNATRACE:  { action: 'get_problems', params: { status: 'OPEN' } },
  VULTR:      { action: 'list_instances', params: {} },
  DATABASE:   { action: 'check_connections', params: {} },
}

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const integration = await prisma.integration.findFirst({ where: { id: params.id, userId: session.user.id } })
  if (!integration) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let config: Record<string, unknown>
  try {
    config = decryptObject<Record<string, unknown>>(integration.config)
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to decrypt config' })
  }

  const testCall = TEST_ACTIONS[integration.type as IntegrationType]
  if (!testCall) {
    return NextResponse.json({ ok: false, error: 'No test defined for this type' })
  }

  // For GitHub, use the configured defaultRepo if available
  const testParams = integration.type === 'GITHUB' && config.defaultRepo
    ? { ...testCall.params, repo: config.defaultRepo }
    : testCall.params

  const result = await executeTool(
    { tool: integration.type as IntegrationType, action: testCall.action, params: testParams, integrationId: params.id },
    { projectId: 'test', bypassHITL: true }
  )

  await prisma.integration.update({
    where: { id: params.id },
    data: { lastTestedAt: new Date(), lastTestOk: result.success },
  })

  return NextResponse.json({ ok: result.success, error: result.error })
}
