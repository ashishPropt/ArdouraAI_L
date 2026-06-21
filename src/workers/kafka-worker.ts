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

// ── Entry point ───────────────────────────────────────────────────────────────

async function main() {
  console.log('[Worker] ArdouraAI SRE Worker starting...')

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
