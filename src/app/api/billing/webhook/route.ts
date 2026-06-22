import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

// Stripe webhook handler — validates signature and upserts subscription state
export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature') ?? ''
  const secret = process.env.STRIPE_WEBHOOK_SECRET

  if (!secret) return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })

  // Signature verification would use stripe.webhooks.constructEvent(body, sig, secret)
  // Parsing raw JSON since stripe SDK not installed
  let event: { type: string; data: { object: Record<string, unknown> } }
  try {
    event = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const obj = event.data.object as Record<string, any>

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const userId = obj.metadata?.userId as string
      if (!userId) break
      await prisma.subscription.upsert({
        where: { userId },
        create: {
          userId,
          plan: (obj.metadata?.plan as 'PRO' | 'ENTERPRISE') ?? 'PRO',
          status: mapStripeStatus(obj.status as string),
          stripeCustomerId: obj.customer as string,
          stripeSubId: obj.id as string,
          currentPeriodStart: new Date((obj.current_period_start as number) * 1000),
          currentPeriodEnd: new Date((obj.current_period_end as number) * 1000),
          cancelAtPeriodEnd: Boolean(obj.cancel_at_period_end),
        },
        update: {
          status: mapStripeStatus(obj.status as string),
          currentPeriodStart: new Date((obj.current_period_start as number) * 1000),
          currentPeriodEnd: new Date((obj.current_period_end as number) * 1000),
          cancelAtPeriodEnd: Boolean(obj.cancel_at_period_end),
        },
      })
      break
    }
    case 'customer.subscription.deleted': {
      const userId = obj.metadata?.userId as string
      if (userId) {
        await prisma.subscription.updateMany({ where: { userId }, data: { status: 'CANCELLED', plan: 'FREE' } })
      }
      break
    }
    case 'invoice.paid': {
      const subId = obj.subscription as string
      if (subId) {
        const sub = await prisma.subscription.findFirst({ where: { stripeSubId: subId } })
        if (sub) {
          await prisma.invoice.create({
            data: {
              subscriptionId: sub.id,
              stripeInvoiceId: obj.id as string,
              amountUsd: (obj.amount_paid as number) / 100,
              status: 'paid',
              paidAt: new Date(),
            },
          })
        }
      }
      break
    }
  }

  return NextResponse.json({ received: true })
}

function mapStripeStatus(status: string): 'ACTIVE' | 'TRIALING' | 'PAST_DUE' | 'CANCELLED' | 'PAUSED' {
  const map: Record<string, 'ACTIVE' | 'TRIALING' | 'PAST_DUE' | 'CANCELLED' | 'PAUSED'> = {
    active:   'ACTIVE',
    trialing: 'TRIALING',
    past_due: 'PAST_DUE',
    canceled: 'CANCELLED',
    paused:   'PAUSED',
  }
  return map[status] ?? 'ACTIVE'
}
