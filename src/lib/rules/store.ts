import { prisma } from '@/lib/db/prisma'
import type { RuleDefinition } from './types'

export async function loadRulesForProject(projectId: string, topic?: string): Promise<RuleDefinition[]> {
  const rules = await prisma.rule.findMany({
    where: {
      OR: [{ projectId }, { projectId: null }],  // project-specific + global rules
      enabled: true,
      ...(topic ? { topic } : {}),
    },
    orderBy: { priority: 'asc' },
  })

  return rules.map(r => ({
    id: r.id,
    name: r.name,
    description: r.description ?? undefined,
    enabled: r.enabled,
    topic: r.topic,
    conditions: r.conditions as any,
    actions: r.actions as any,
    cooldownMs: r.cooldownMs ?? undefined,
  }))
}

export async function createRule(projectId: string, def: Omit<RuleDefinition, 'id'>, userId: string) {
  return prisma.rule.create({
    data: {
      projectId,
      userId,
      name: def.name,
      description: def.description,
      enabled: def.enabled,
      topic: def.topic,
      conditions: def.conditions as any,
      actions: def.actions as any,
      cooldownMs: def.cooldownMs,
      priority: 100,
      fireCount: 0,
    },
  })
}

export async function updateRule(id: string, projectId: string, patch: Partial<Omit<RuleDefinition, 'id'>>) {
  return prisma.rule.update({
    where: { id, projectId },
    data: {
      ...(patch.name !== undefined && { name: patch.name }),
      ...(patch.description !== undefined && { description: patch.description }),
      ...(patch.enabled !== undefined && { enabled: patch.enabled }),
      ...(patch.topic !== undefined && { topic: patch.topic }),
      ...(patch.conditions !== undefined && { conditions: patch.conditions as any }),
      ...(patch.actions !== undefined && { actions: patch.actions as any }),
      ...(patch.cooldownMs !== undefined && { cooldownMs: patch.cooldownMs }),
    },
  })
}

export async function deleteRule(id: string, projectId: string) {
  return prisma.rule.delete({ where: { id, projectId } })
}
