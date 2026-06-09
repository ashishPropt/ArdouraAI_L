import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth/config'
import { prisma } from '@/lib/db/prisma'
import { routedStream } from '@/lib/llm/router'
import { SYSTEM_PROMPT_CHAT } from '@/lib/codegen/prompts'
import type { LLMMessage } from '@/lib/llm/providers/anthropic'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authConfig)
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const { projectId, message } = await req.json()
  if (!projectId || !message) {
    return new Response(JSON.stringify({ error: 'projectId and message required' }), { status: 400 })
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: session.user.id },
    include: { messages: { orderBy: { createdAt: 'asc' }, take: 30 } },
  })
  if (!project) return new Response(JSON.stringify({ error: 'Project not found' }), { status: 404 })

  // Save user message
  await prisma.message.create({
    data: { projectId, role: 'USER', content: message },
  })

  // Build conversation history
  const history: LLMMessage[] = project.messages.map((m) => ({
    role: m.role === 'USER' ? 'user' : 'assistant',
    content: m.content,
  }))
  history.push({ role: 'user', content: message })

  // Stream response
  const encoder = new TextEncoder()
  let fullResponse = ''

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const { text, model } = await routedStream(
          history,
          SYSTEM_PROMPT_CHAT,
          'medium',
          (chunk) => {
            fullResponse += chunk
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'chunk', text: chunk })}\n\n`))
          }
        )

        // Check if generation was triggered
        const shouldGenerate = text.includes('##GENERATE##')

        // Save assistant message
        await prisma.message.create({
          data: {
            projectId,
            role: 'ASSISTANT',
            content: text.replace('##GENERATE##', '').trim(),
            metadata: { model },
          },
        })

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'done', shouldGenerate, model })}\n\n`)
        )
      } catch (err) {
        console.error('Chat stream error:', err)
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'Generation failed' })}\n\n`)
        )
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
