import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'
import { routedStream } from '@/lib/llm/router'

const SYSTEM = `You are an expert SRE writing a structured incident postmortem.
Return a well-formatted markdown document with these sections:
## Summary
## Timeline
## Root Cause
## Impact
## Resolution
## Action Items
Be concise, factual, and actionable.`

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectId, incidentId } = await req.json()
  const project = await prisma.project.findFirst({ where: { id: projectId, userId: session.user.id } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const incident = incidentId
    ? await prisma.incident.findUnique({ where: { id: incidentId }, include: { healActions: true, monitor: true } })
    : null

  const recentIncidents = await prisma.incident.findMany({
    where: { projectId },
    orderBy: { startedAt: 'desc' },
    take: 5,
    include: { healActions: { take: 3 } },
  })

  const context = incident
    ? `Incident: ${incident.title} | Severity: ${incident.severity} | Status: ${incident.status}
Started: ${incident.startedAt.toISOString()} | Resolved: ${incident.resolvedAt?.toISOString() ?? 'Ongoing'}
Root cause: ${incident.rootCause ?? 'Unknown'}
Resolution: ${incident.resolution ?? 'Pending'}
Monitor: ${incident.monitor?.name ?? 'N/A'} (${incident.monitor?.url ?? 'N/A'})
Heal actions attempted: ${incident.healActions.length}`
    : `Project: ${project.name}
Recent incidents (last 5):
${recentIncidents.map(i => `- [${i.severity}] ${i.title} | ${i.status} | ${i.startedAt.toISOString()}`).join('\n')}`

  const encoder = new TextEncoder()
  let fullText = ''

  const stream = new ReadableStream({
    async start(controller) {
      try {
        await routedStream(
          [{ role: 'user', content: `Generate a postmortem for:\n${context}` }],
          SYSTEM,
          'high',
          (chunk) => {
            fullText += chunk
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`))
          }
        )

        await prisma.insight.create({
          data: {
            projectId,
            userId: session.user.id,
            type: 'POSTMORTEM',
            title: incident ? `Postmortem: ${incident.title}` : `Postmortem: ${project.name}`,
            content: fullText,
            metadata: { incidentId: incidentId ?? null },
          },
        })

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`))
        controller.close()
      } catch (err) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: String(err) })}\n\n`))
        controller.close()
      }
    },
  })

  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } })
}
