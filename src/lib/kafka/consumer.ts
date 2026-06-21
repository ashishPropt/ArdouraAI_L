import type { Consumer, EachMessagePayload } from 'kafkajs'
import { getKafka } from './client'
import type { TopicName } from './topics'
import type { ArdouraEvent } from './events'

export type EventHandler = (event: ArdouraEvent, raw: EachMessagePayload) => Promise<void>

export async function createConsumer(
  groupId: string,
  topics: TopicName[],
  handler: EventHandler
): Promise<Consumer> {
  const consumer = getKafka().consumer({ groupId, sessionTimeout: 30000 })
  await consumer.connect()
  await consumer.subscribe({ topics, fromBeginning: false })

  await consumer.run({
    eachMessage: async (payload) => {
      if (!payload.message.value) return
      try {
        const event = JSON.parse(payload.message.value.toString()) as ArdouraEvent
        await handler(event, payload)
      } catch (err) {
        console.error(`[Consumer:${groupId}] Error processing message:`, err)
      }
    },
  })

  return consumer
}
