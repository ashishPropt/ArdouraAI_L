/**
 * One-time script to create all Ardoura Kafka topics.
 * Run: npx tsx scripts/setup-kafka-topics.ts
 */
import { Kafka } from 'kafkajs'
import { ALL_TOPICS } from '../src/lib/kafka/topics'

const brokers = (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(',')

const kafka = new Kafka({ clientId: 'ardoura-setup', brokers })
const admin = kafka.admin()

async function main() {
  await admin.connect()
  console.log('Connected to Kafka brokers:', brokers)

  const existing = await admin.listTopics()
  const toCreate = ALL_TOPICS.filter(t => !existing.includes(t))

  if (toCreate.length === 0) {
    console.log('All topics already exist:', ALL_TOPICS.length, 'topics')
  } else {
    await admin.createTopics({
      topics: toCreate.map(topic => ({
        topic,
        numPartitions: 3,
        replicationFactor: 1,
        configEntries: [
          { name: 'retention.ms', value: String(7 * 24 * 60 * 60 * 1000) }, // 7 days
          { name: 'cleanup.policy', value: 'delete' },
        ],
      })),
    })
    console.log('Created topics:', toCreate)
  }

  const metadata = await admin.fetchTopicMetadata({ topics: ALL_TOPICS })
  for (const topic of metadata.topics) {
    console.log(`  ${topic.name}: ${topic.partitions.length} partition(s)`)
  }

  await admin.disconnect()
  console.log('Done.')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
