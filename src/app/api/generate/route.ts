import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'
import { generateProject } from '@/lib/codegen/generator'
import type { LLMMessage } from '@/lib/llm/providers/anthropic'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const { projectId } = await req.json()

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: session.user.id },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  })
  if (!project) return new Response(JSON.stringify({ error: 'Project not found' }), { status: 404 })

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))

      try {
        send({ type: 'status', message: 'Analyzing requirements...' })

        const history: LLMMessage[] = project.messages.map((m) => ({
          role: m.role === 'USER' ? 'user' : 'assistant',
          content: m.content,
        }))

        const description = project.description || project.messages[0]?.content || project.name
        send({ type: 'status', message: 'Generating code with AI...' })

        const generated = await generateProject(description, history)

        send({ type: 'status', message: 'Saving generated files...' })

        for (const file of generated.files) {
          await prisma.projectFile.upsert({
            where: { projectId_path: { projectId, path: file.path } },
            create: { projectId, path: file.path, content: file.content, language: file.language },
            update: { content: file.content, language: file.language },
          })
        }

        await prisma.project.update({
          where: { id: projectId },
          data: { name: generated.projectName || project.name, description: generated.description },
        })

        send({
          type: 'complete',
          files: generated.files,
          setupCommands: generated.setupCommands,
          envVars: generated.envVars,
          projectName: generated.projectName,
        })
      } catch (err: any) {
        console.error('Generate error:', err)
        send({ type: 'error', message: err.message || 'Code generation failed' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  })
}
