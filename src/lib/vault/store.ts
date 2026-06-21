import { prisma } from '@/lib/db/prisma'
import { encryptObject, decryptObject } from './encrypt'
import type { IntegrationType } from '@prisma/client'

export async function saveIntegrationConfig(
  userId: string,
  type: IntegrationType,
  name: string,
  config: Record<string, unknown>
) {
  const encrypted = encryptObject(config)
  return prisma.integration.upsert({
    where: { id: `${userId}-${type}-${name}`.slice(0, 25) },
    create: { userId, type, name, config: encrypted },
    update: { config: encrypted, active: true, updatedAt: new Date() },
  })
}

export async function getIntegrationConfig<T = Record<string, unknown>>(
  userId: string,
  type: IntegrationType,
  name?: string
): Promise<T | null> {
  const where = name
    ? { userId, type, name, active: true }
    : { userId, type, active: true }

  const row = await prisma.integration.findFirst({ where })
  if (!row) return null
  return decryptObject<T>(row.config)
}

export async function listIntegrations(userId: string) {
  const rows = await prisma.integration.findMany({
    where: { userId },
    orderBy: { type: 'asc' },
    select: { id: true, type: true, name: true, active: true, lastTestedAt: true, lastTestOk: true, createdAt: true },
  })
  return rows
}

export async function deleteIntegration(id: string, userId: string) {
  return prisma.integration.deleteMany({ where: { id, userId } })
}

export async function markIntegrationTested(id: string, ok: boolean) {
  return prisma.integration.update({
    where: { id },
    data: { lastTestedAt: new Date(), lastTestOk: ok },
  })
}
