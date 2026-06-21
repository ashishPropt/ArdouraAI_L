import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'
import { createHash, randomBytes } from 'crypto'

function hashKey(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const keys = await prisma.apiKey.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, prefix: true, scopes: true, active: true, lastUsedAt: true, expiresAt: true, createdAt: true },
  })

  return NextResponse.json(keys)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, scopes = ['read'], expiresInDays } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const raw = `ardoura_${randomBytes(32).toString('hex')}`
  const keyHash = hashKey(raw)
  const prefix = raw.slice(0, 12)

  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    : null

  const key = await prisma.apiKey.create({
    data: { userId: session.user.id, name, keyHash, prefix, scopes, expiresAt: expiresAt ?? undefined },
  })

  // Return raw key ONLY on creation — never stored
  return NextResponse.json({ ...key, key: raw }, { status: 201 })
}
