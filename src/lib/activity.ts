import { prisma } from '@/lib/db/prisma'

export async function logActivity({
  userId,
  projectId,
  action,
  entity,
  entityId,
  metadata,
}: {
  userId?: string
  projectId?: string
  action: string
  entity?: string
  entityId?: string
  metadata?: Record<string, unknown>
}) {
  try {
    await prisma.activityLog.create({
      data: { userId, projectId, action, entity, entityId, metadata: (metadata ?? {}) as any },
    })
  } catch (err) {
    console.error('logActivity error:', err)
  }
}
