import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'
import { routedStream } from '@/lib/llm/router'

const SYSTEM = `You are a senior software engineer performing a code review.
Analyze the provided code for:
- Bugs and correctness issues
- Security vulnerabilities (OWASP Top 10)
- Performance problems
- Code quality and maintainability
- Missing error handling

Format findings as markdown with severity badges: 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low
End with a summary score (1-10) and top 3 actionable recommendations.`

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectId, filePath } = await req.json()
  const project = await prisma.project.findFirst({ where: { id: projectId, userId: session.user.id } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const files = filePath
    ? await prisma.projectFile.findMany({ where: { projectId, path: filePath } })
    : await prisma.projectFile.findMany({ where: { projectId }, take: 10, orderBy: { updatedAt: 'desc' } })

  if (files.length === 0) return NextResponse.json({ error: 'No files found' }, { status: 404 })

  const codeContext = files
    .map(f => `### ${f.path}\n\`\`\`${f.language ?? ''}\n${f.content.slice(0, 3000)}\n\`\`\``)
    .join('\n\n')

  const encoder = new TextEncoder()
  let fullText = ''

  const stream = new ReadableStream({
    async start(controller) {
      try {
        await routedStream(
          [{ role: 'user', content: `Review this code from project "${project.name}":\n\n${codeContext}` }],
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
            type: 'CODE_REVIEW',
            title: `Code Review: ${filePath ?? project.name}`,
            content: fullText,
            metadata: { filePath: filePath ?? null, fileCount: files.length },
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
