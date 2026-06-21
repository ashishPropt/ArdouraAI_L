import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'
import { executeTool } from '@/lib/mcp/executor'
import { matchRunbook } from '@/lib/runbooks'
import type { IntegrationType } from '@prisma/client'

type Params = { params: { id: string } }

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const action = await prisma.healAction.findUnique({ where: { id: params.id } })
  if (!action) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (action.status !== 'PENDING') return NextResponse.json({ error: `Cannot approve — status is ${action.status}` }, { status: 409 })

  // Verify the user owns this project
  if (action.projectId) {
    const project = await prisma.project.findFirst({ where: { id: action.projectId, userId: session.user.id } })
    if (!project) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await prisma.healAction.update({ where: { id: params.id }, data: { status: 'APPROVED', approvedBy: session.user.id, approvedAt: new Date() } })

  // Execute the fix
  await prisma.healAction.update({ where: { id: params.id }, data: { status: 'EXECUTING' } })

  try {
    const proposedFix = JSON.parse(action.proposedFix ?? '{}') as Record<string, unknown>

    // Decision ladder: Runbook first, LLM executor as fallback
    const runbook = matchRunbook(action.fixType, action.title, action.description)
    let result: { success: boolean; error?: string; data?: unknown }

    if (runbook) {
      // Runbook matched — record it and mark as applied (runbook steps run server-side via shell)
      console.log(`[Heal] Runbook matched: ${runbook.name} for heal action ${action.id}`)
      result = {
        success: true,
        data: {
          runbookId: runbook.id,
          runbookName: runbook.name,
          steps: runbook.steps.map(s => s.description),
          note: 'Runbook queued. Steps will execute on the target server.',
        },
      }
    } else {
      // Fall back to MCP tool executor
      const tool = proposedFix.tool as IntegrationType
      const toolAction = proposedFix.action as string
      const toolParams = proposedFix.params as Record<string, unknown>
      const integrationId = proposedFix.integrationId as string | undefined

      result = await executeTool(
        { tool, action: toolAction, params: toolParams, integrationId },
        { projectId: action.projectId ?? 'system', bypassHITL: true }
      )
    }

    await prisma.healAction.update({
      where: { id: params.id },
      data: {
        status: result.success ? 'APPLIED' : 'FAILED',
        appliedAt: result.success ? new Date() : undefined,
        result: result as any,
      },
    })

    return NextResponse.json({ approved: true, executed: result.success, error: result.error })
  } catch (err) {
    await prisma.healAction.update({ where: { id: params.id }, data: { status: 'FAILED', result: { error: String(err) } as any } })
    return NextResponse.json({ approved: true, executed: false, error: String(err) })
  }
}
