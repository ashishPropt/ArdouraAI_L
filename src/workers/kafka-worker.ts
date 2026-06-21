/**
 * Kafka worker — runs as a separate Node.js process alongside Next.js.
 *
 * When Kafka is available it consumes all Ardoura topics.
 * When Kafka is NOT available it polls the KafkaEvent DB table (DB-mode fallback).
 *
 * Start with: npm run worker
 * Dev mode:   npm run worker:dev
 */

import 'dotenv/config'
import { prisma } from '@/lib/db/prisma'
import { isKafkaEnabled } from '@/lib/kafka/client'
import { createConsumer } from '@/lib/kafka/consumer'
import { ALL_TOPICS } from '@/lib/kafka/topics'
import type { ArdouraEvent } from '@/lib/kafka/events'
import { processEventWithRules } from '@/lib/rules/actions'

const WORKER_GROUP = 'ardoura-sre-worker'
const DB_POLL_INTERVAL_MS = 5000
const DB_BATCH_SIZE = 50
const MONITOR_POLL_INTERVAL_MS = 60_000  // 1 minute

// Track consecutive failures per monitor to avoid noisy incident creation
const failureStreak: Record<string, number> = {}

async function handleEvent(event: ArdouraEvent) {
  // Resolve which project this event belongs to
  const projectId = event.projectId
  if (!projectId) {
    // Global events (platform-level) — skip rule matching for now
    return
  }

  try {
    const results = await processEventWithRules(event, projectId)
    for (const r of results) {
      if (r.errors.length > 0) {
        console.error(`[Worker] Rule "${r.ruleName}" errors:`, r.errors)
      } else if (!r.skippedCooldown) {
        console.log(`[Worker] Rule "${r.ruleName}" fired — actions: ${r.actionsTriggered}, HITL: ${r.actionsRequiringHITL}`)
      }
    }
  } catch (err) {
    console.error('[Worker] processEventWithRules error:', err)
  }
}

// ── Kafka mode ────────────────────────────────────────────────────────────────

async function runKafkaWorker() {
  console.log('[Worker] Starting in Kafka mode — topics:', ALL_TOPICS.length)
  const consumer = await createConsumer(WORKER_GROUP, ALL_TOPICS, async (event) => {
    await handleEvent(event)
  })

  process.on('SIGTERM', async () => {
    console.log('[Worker] SIGTERM — shutting down Kafka consumer')
    await consumer.disconnect()
    process.exit(0)
  })

  console.log('[Worker] Kafka consumer running')
}

// ── DB-polling fallback mode ──────────────────────────────────────────────────

async function runDbWorker() {
  console.log('[Worker] Kafka not configured — running in DB-polling mode')

  async function poll() {
    try {
      const events = await prisma.kafkaEvent.findMany({
        where: { processed: false },
        orderBy: { createdAt: 'asc' },
        take: DB_BATCH_SIZE,
      })

      for (const row of events) {
        try {
          const event = row.payload as unknown as ArdouraEvent
          await handleEvent(event)
          await prisma.kafkaEvent.update({
            where: { id: row.id },
            data: { processed: true, processedAt: new Date() },
          })
        } catch (err) {
          console.error(`[Worker] Failed to process event ${row.id}:`, err)
          // Mark as processed to avoid infinite retry — error will appear in logs
          await prisma.kafkaEvent.update({
            where: { id: row.id },
            data: { processed: true, processedAt: new Date(), error: String(err) },
          })
        }
      }
    } catch (err) {
      console.error('[Worker] DB poll error:', err)
    }

    setTimeout(poll, DB_POLL_INTERVAL_MS)
  }

  process.on('SIGTERM', async () => {
    console.log('[Worker] SIGTERM — shutting down DB worker')
    await prisma.$disconnect()
    process.exit(0)
  })

  poll()
}

// ── Monitor poller ────────────────────────────────────────────────────────────

async function pollMonitors() {
  try {
    const monitors = await prisma.monitor.findMany({
      where: { active: true },
    })

    for (const monitor of monitors) {
      const start = Date.now()
      let status = 'UP'
      let statusCode: number | null = null
      let responseMs: number | null = null
      let error: string | null = null

      try {
        const controller = new AbortController()
        const tid = setTimeout(() => controller.abort(), monitor.timeoutSecs * 1000)
        const res = await fetch(monitor.url, { method: monitor.method, signal: controller.signal })
        clearTimeout(tid)
        responseMs = Date.now() - start
        statusCode = res.status
        if (res.status !== monitor.expectedStatus) {
          status = res.status >= 500 ? 'DOWN' : 'DEGRADED'
        }
      } catch (err: any) {
        responseMs = Date.now() - start
        status = err.name === 'AbortError' ? 'TIMEOUT' : 'DOWN'
        error = err.message ?? String(err)
      }

      await prisma.monitorCheck.create({
        data: { monitorId: monitor.id, status, statusCode, responseMs, error, checkedAt: new Date() },
      })

      await prisma.monitor.update({
        where: { id: monitor.id },
        data: { lastStatus: status, lastCheckedAt: new Date() },
      })

      if (status !== 'UP') {
        failureStreak[monitor.id] = (failureStreak[monitor.id] ?? 0) + 1
        if (failureStreak[monitor.id] === 2) {
          // 2 consecutive failures → create incident
          const existing = await prisma.incident.findFirst({
            where: { monitorId: monitor.id, status: { not: 'RESOLVED' } },
          })
          if (!existing) {
            await prisma.incident.create({
              data: {
                monitorId: monitor.id,
                projectId: monitor.projectId,
                title: `${monitor.name} is ${status}`,
                severity: status === 'DOWN' ? 'P1' : 'P2',
                status: 'OPEN',
                source: 'MONITOR',
              },
            })
            console.log(`[Monitor] Incident created for ${monitor.name} (${status})`)
          }
        }
      } else {
        failureStreak[monitor.id] = 0
        // Auto-resolve open monitor incidents
        await prisma.incident.updateMany({
          where: { monitorId: monitor.id, status: 'OPEN' },
          data: { status: 'RESOLVED', resolvedAt: new Date(), resolution: 'Monitor recovered automatically' },
        })
      }
    }
  } catch (err) {
    console.error('[Monitor] Poll error:', err)
  }
}

function startMonitorPoller() {
  console.log('[Monitor] Poller started — interval:', MONITOR_POLL_INTERVAL_MS / 1000, 's')
  pollMonitors()
  setInterval(pollMonitors, MONITOR_POLL_INTERVAL_MS)
}

// ── Entry point ───────────────────────────────────────────────────────────────

async function main() {
  console.log('[Worker] ArdouraAI SRE Worker starting...')

  // Always start monitor poller regardless of Kafka mode
  startMonitorPoller()

  if (isKafkaEnabled()) {
    await runKafkaWorker()
  } else {
    await runDbWorker()
  }
}

main().catch(err => {
  console.error('[Worker] Fatal error:', err)
  process.exit(1)
})
