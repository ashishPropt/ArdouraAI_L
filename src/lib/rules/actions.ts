import { prisma } from '@/lib/db/prisma'
import { executeTool } from '@/lib/mcp/executor'
import { interpolate } from './evaluator'
import type { RuleDefinition, RuleAction } from './types'
import type { ArdouraEvent } from '@/lib/kafka/events'
import type { IntegrationType } from '@prisma/client'

// Track last fire times for cooldown (in-memory, good enough for single-process)
const lastFiredAt: Map<string, number> = new Map()

export interface RuleFireResult {
  ruleId: string
  ruleName: string
  skippedCooldown: boolean
  actionsTriggered: number
  actionsRequiringHITL: number
  errors: string[]
}

async function findIntegrationId(projectId: string, tool: string, provided?: string): Promise<string | undefined> {
  if (provided) return provided
  // Find an active integration of this type owned by any user in the project
  // Integration is user-scoped; we find the project owner's integration
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { userId: true } })
  if (!project) return undefined
  const integration = await prisma.integration.findFirst({
    where: { userId: project.userId, type: tool as IntegrationType, active: true },
    select: { id: true },
  })
  return integration?.id
}

async function executeAction(
  ruleAction: RuleAction,
  event: ArdouraEvent,
  projectId: string
): Promise<{ success: boolean; requiresHITL?: boolean; error?: string }> {
  const integrationId = await findIntegrationId(projectId, ruleAction.tool, ruleAction.integrationId)
  if (!integrationId) {
    return { success: false, error: `No active ${ruleAction.tool} integration found for project ${projectId}` }
  }

  // Interpolate event values into params
  const resolvedParams = interpolate(ruleAction.params, event) as Record<string, unknown>

  const result = await executeTool(
    { tool: ruleAction.tool as IntegrationType, action: ruleAction.action, params: resolvedParams, integrationId },
    { projectId }
  )

  if (result.requiresHITL) {
    // Create a HealAction record pending approval
    await prisma.healAction.create({
      data: {
        projectId,
        title: `Rule action: ${ruleAction.tool}.${ruleAction.action}`,
        description: `Auto-triggered by rule. Params: ${JSON.stringify(resolvedParams, null, 2)}`,
        fixType: `${ruleAction.tool}_${ruleAction.action}`,
        riskLevel: (result.riskLevel ?? 'MEDIUM') as any,
        evidence: { event: event as unknown as Record<string, unknown>, params: resolvedParams } as any,
        proposedFix: JSON.stringify(resolvedParams),
        status: 'PENDING',
      },
    })
    return { success: false, requiresHITL: true }
  }

  return { success: result.success, error: result.error }
}

export async function fireRule(
  rule: RuleDefinition,
  event: ArdouraEvent,
  projectId: string
): Promise<RuleFireResult> {
  const result: RuleFireResult = {
    ruleId: rule.id,
    ruleName: rule.name,
    skippedCooldown: false,
    actionsTriggered: 0,
    actionsRequiringHITL: 0,
    errors: [],
  }

  // Cooldown check
  const cooldownMs = rule.cooldownMs ?? 5 * 60 * 1000
  const lastFired = lastFiredAt.get(rule.id) ?? 0
  if (Date.now() - lastFired < cooldownMs) {
    result.skippedCooldown = true
    return result
  }
  lastFiredAt.set(rule.id, Date.now())

  for (const action of rule.actions) {
    try {
      const res = await executeAction(action, event, projectId)
      if (res.requiresHITL) {
        result.actionsRequiringHITL++
      } else if (res.success) {
        result.actionsTriggered++
      } else if (res.error) {
        result.errors.push(res.error)
      }
    } catch (err) {
      result.errors.push(err instanceof Error ? err.message : String(err))
    }
  }

  // Persist fire record to DB
  await prisma.rule.update({
    where: { id: rule.id },
    data: { lastFiredAt: new Date(), fireCount: { increment: 1 } },
  }).catch(() => { /* rule may be stored in memory only */ })

  return result
}

export async function processEventWithRules(
  event: ArdouraEvent,
  projectId: string
): Promise<RuleFireResult[]> {
  const { matchingRules } = await import('./evaluator')
  const { loadRulesForProject } = await import('./store')

  const rules = await loadRulesForProject(projectId, event.topic)
  const matched = matchingRules(rules, event)

  return Promise.all(matched.map(rule => fireRule(rule, event, projectId)))
}
