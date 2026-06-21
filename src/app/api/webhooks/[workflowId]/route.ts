import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { executeWorkflow } from '@/lib/workflows/executor'

type Params = { params: { workflowId: string } }

export async function POST(req: NextRequest, { params }: Params) {
  const workflow = await prisma.workflow.findUnique({ where: { id: params.workflowId } })
  if (!workflow || !workflow.active || workflow.trigger !== 'WEBHOOK') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Verify webhook secret if set
  if (workflow.webhookSecret) {
    const sig = req.headers.get('x-ardoura-signature') ?? ''
    if (sig !== workflow.webhookSecret) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
  }

  const body = await req.json().catch(() => ({}))

  const runId = await executeWorkflow(params.workflowId, 'webhook', body)

  return NextResponse.json({ runId, status: 'triggered' })
}
