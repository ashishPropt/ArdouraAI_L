import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const budgets = await prisma.tokenBudget.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ budgets })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, limitUsd, model, action, alertPct } = await req.json()
  if (!name || !limitUsd) return NextResponse.json({ error: 'name and limitUsd required' }, { status: 400 })

  const budget = await prisma.tokenBudget.create({
    data: {
      userId: session.user.id,
      name,
      limitUsd: parseFloat(limitUsd),
      currentUsd: 0,
      model: model ?? null,
      action: action ?? 'ALERT',
      alertPct: alertPct ?? 80,
    },
  })

  return NextResponse.json({ budget }, { status: 201 })
}
