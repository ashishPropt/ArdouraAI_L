import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const start = Date.now()
  const checks: Record<string, { status: string; latencyMs?: number; error?: string }> = {}

  // Database check
  try {
    await prisma.$queryRaw`SELECT 1`
    checks.database = { status: 'ok', latencyMs: Date.now() - start }
  } catch (err) {
    checks.database = { status: 'error', error: String(err) }
  }

  // Kafka check (optional)
  const kafkaEnabled = !!process.env.KAFKA_BROKERS
  checks.kafka = { status: kafkaEnabled ? 'configured' : 'disabled' }

  const allOk = Object.values(checks).every(c => c.status === 'ok' || c.status === 'configured' || c.status === 'disabled')

  return NextResponse.json(
    {
      status: allOk ? 'healthy' : 'degraded',
      version: process.env.npm_package_version ?? '0.1.0',
      checks,
      timestamp: new Date().toISOString(),
      uptimeMs: process.uptime() * 1000,
    },
    {
      status: allOk ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    }
  )
}
