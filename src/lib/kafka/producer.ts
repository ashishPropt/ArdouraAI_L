import type { Producer } from 'kafkajs'
import { getKafka, isKafkaEnabled } from './client'
import { prisma } from '@/lib/db/prisma'
import type { ArdouraEvent } from './events'
import type { TopicName } from './topics'

let producer: Producer | null = null

async function getProducer(): Promise<Producer> {
  if (!producer) {
    producer = getKafka().producer({ allowAutoTopicCreation: true })
    await producer.connect()
  }
  return producer
}

export async function publish(topic: TopicName, event: ArdouraEvent): Promise<void> {
  // Always log to DB — Kafka is optional
  await prisma.kafkaEvent.create({
    data: {
      topic,
      key: event.id,
      payload: event as any,
      source: event.source,
      processed: false,
    },
  })

  if (!isKafkaEnabled()) return

  try {
    const p = await getProducer()
    await p.send({
      topic,
      messages: [{ key: event.id, value: JSON.stringify(event) }],
    })
  } catch (err) {
    console.error(`[Kafka] Failed to publish to ${topic}:`, err)
    // Non-fatal — event is already in DB, worker will pick it up
  }
}

export async function publishMany(events: { topic: TopicName; event: ArdouraEvent }[]): Promise<void> {
  await Promise.all(events.map(({ topic, event }) => publish(topic, event)))
}

export async function disconnectProducer(): Promise<void> {
  if (producer) {
    await producer.disconnect()
    producer = null
  }
}
