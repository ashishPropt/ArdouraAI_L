import { Kafka, type KafkaConfig, logLevel } from 'kafkajs'

let kafka: Kafka | null = null

export function getKafka(): Kafka {
  if (!kafka) {
    const brokers = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',')
    const config: KafkaConfig = {
      clientId: 'ardoura-ai',
      brokers,
      logLevel: process.env.NODE_ENV === 'production' ? logLevel.ERROR : logLevel.WARN,
    }

    if (process.env.KAFKA_SASL_USERNAME) {
      config.ssl = true
      config.sasl = {
        mechanism: 'scram-sha-256',
        username: process.env.KAFKA_SASL_USERNAME,
        password: process.env.KAFKA_SASL_PASSWORD || '',
      }
    }

    kafka = new Kafka(config)
  }
  return kafka
}

export function isKafkaEnabled(): boolean {
  return !!process.env.KAFKA_BROKERS
}
