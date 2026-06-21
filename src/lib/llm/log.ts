import { prisma } from '@/lib/db/prisma'
import { estimateCost, getModelInfo } from './router'

export async function logLLMUsage({
  userId,
  projectId,
  model,
  feature,
  inputTokens,
  outputTokens,
}: {
  userId: string
  projectId?: string
  model: string
  feature: string
  inputTokens: number
  outputTokens: number
}) {
  const { provider } = getModelInfo(model)
  const costUsd = estimateCost(model, inputTokens, outputTokens)

  try {
    await prisma.lLMUsageLog.create({
      data: { userId, projectId, provider, model, feature, inputTokens, outputTokens, costUsd },
    })

    // Update any matching budgets
    const budgets = await prisma.tokenBudget.findMany({
      where: { userId, OR: [{ model: null }, { model }] },
    })
    for (const budget of budgets) {
      await prisma.tokenBudget.update({
        where: { id: budget.id },
        data: { currentUsd: { increment: costUsd } },
      })
    }
  } catch (err) {
    console.error('logLLMUsage error:', err)
  }
}
