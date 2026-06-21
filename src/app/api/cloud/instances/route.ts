import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'
import { decryptObject } from '@/lib/vault/encrypt'
import { vultrTool } from '@/lib/mcp/tools/vultr'

async function getVultrConfig(userId: string) {
  const integration = await prisma.integration.findFirst({
    where: { userId, type: 'VULTR', active: true },
  })
  if (!integration) return null
  try {
    return { config: decryptObject<{ apiKey: string }>(integration.config), integrationId: integration.id }
  } catch { return null }
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const vultr = await getVultrConfig(session.user.id)
  if (!vultr) return NextResponse.json({ error: 'No active Vultr integration found. Add one in Integrations.' }, { status: 404 })

  const result = await vultrTool('list_instances', {}, vultr.config as unknown as Record<string, unknown>)
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 502 })

  return NextResponse.json({ instances: result.data })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { action, instanceId, params } = body

  const vultr = await getVultrConfig(session.user.id)
  if (!vultr) return NextResponse.json({ error: 'No active Vultr integration' }, { status: 404 })

  // All mutating actions go through HITL — create a HealAction instead of executing directly
  const HIGH_RISK = ['create_instance', 'delete_instance', 'resize_instance', 'reboot_instance']
  if (HIGH_RISK.includes(action)) {
    const healAction = await prisma.healAction.create({
      data: {
        title: `Cloud: ${action.replace(/_/g, ' ')} ${instanceId ?? ''}`.trim(),
        description: `Requested by ${session.user.email} via Cloud Manager`,
        fixType: `VULTR_${action.toUpperCase()}`,
        riskLevel: action === 'reboot_instance' ? 'MEDIUM' : 'HIGH',
        status: 'PENDING',
        evidence: { requestedBy: session.user.id, params: { instanceId, ...params } } as any,
        proposedFix: JSON.stringify({ tool: 'VULTR', action, params: { instanceId, ...params }, integrationId: vultr.integrationId }),
      },
    })
    return NextResponse.json({ queued: true, healActionId: healAction.id }, { status: 202 })
  }

  // Read-only actions execute immediately
  const result = await vultrTool(action, { instanceId, ...params }, vultr.config as unknown as Record<string, unknown>)
  return NextResponse.json(result)
}
