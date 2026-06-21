import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'
import { routedStream } from '@/lib/llm/router'

const SYSTEM = `You are ArdouraAI Advisor — an expert in startup engineering, SRE, and product development.
Analyze the project's health metrics and provide actionable recommendations.
Format as markdown with clear sections: ## Health Score, ## Strengths, ## Risks, ## Recommendations.
Be specific, practical, and prioritize by impact.`

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectId, question } = await req.json()
  const project = await prisma.project.findFirst({ where: { id: projectId, userId: session.user.id } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [incidents, heals, monitors, files, llmCost] = await Promise.all([
    prisma.incident.findMany({ where: { projectId }, orderBy: { startedAt: 'desc' }, take: 10 }),
    prisma.healAction.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' }, take: 10 }),
    prisma.monitor.findMany({ where: { projectId } }),
    prisma.projectFile.count({ where: { projectId } }),
    prisma.lLMUsageLog.aggregate({ where: { projectId }, _sum: { costUsd: true } }),
  ])

  const uptimeData = monitors.length > 0
    ? `Monitors: ${monitors.length} | Up: ${monitors.filter(m => m.lastStatus === 'UP').length}`
    : 'No monitors configured'

  const context = `Project: ${project.name}
Status: ${project.status}
Files: ${files}
Total LLM cost: $${(llmCost._sum.costUsd ?? 0).toFixed(4)}
${uptimeData}
Incidents (last 10): ${incidents.length} | Open: ${incidents.filter(i => i.status === 'OPEN').length}
Auto-heals: ${heals.length} | Applied: ${heals.filter(h => h.status === 'APPLIED').length}
Deployed: ${project.deployedUrl ?? 'No'}

User question: ${question ?? 'Give me a full health assessment and top recommendations.'}`

  const encoder = new TextEncoder()
  let fullText = ''

  const stream = new ReadableStream({
    async start(controller) {
      try {
        await routedStream(
          [{ role: 'user', content: context }],
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
            type: 'ADVISOR',
            title: `Advisor: ${question?.slice(0, 60) ?? 'Health Assessment'}`,
            content: fullText,
            metadata: { question: question ?? null },
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
