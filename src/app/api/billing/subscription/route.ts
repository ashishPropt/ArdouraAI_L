import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'
import { getUserUsageSummary } from '@/lib/billing/usage'
import { PLAN_PRICES } from '@/lib/billing/plans'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [sub, summary] = await Promise.all([
    prisma.subscription.findUnique({
      where: { userId: session.user.id },
      include: { invoices: { orderBy: { createdAt: 'desc' }, take: 6 } },
    }),
    getUserUsageSummary(session.user.id),
  ])

  return NextResponse.json({ subscription: sub, ...summary, prices: PLAN_PRICES })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { plan } = await req.json()
  if (!['FREE', 'PRO', 'ENTERPRISE'].includes(plan)) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
  }

  if (plan === 'FREE') {
    await prisma.subscription.upsert({
      where: { userId: session.user.id },
      create: { userId: session.user.id, plan: 'FREE', status: 'ACTIVE' },
      update: { plan: 'FREE', status: 'ACTIVE', cancelAtPeriodEnd: false },
    })
    return NextResponse.json({ plan: 'FREE', message: 'Downgraded to Free' })
  }

  // Stripe integration point — return checkout URL when STRIPE_SECRET_KEY configured
  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) {
    return NextResponse.json({
      error: 'Stripe not configured. Set STRIPE_SECRET_KEY to enable payments.',
      plan,
      prices: PLAN_PRICES[plan as 'PRO' | 'ENTERPRISE'],
    }, { status: 503 })
  }

  // Real Stripe checkout would go here
  return NextResponse.json({ message: 'Stripe checkout not yet wired — add STRIPE_SECRET_KEY' }, { status: 501 })
}
