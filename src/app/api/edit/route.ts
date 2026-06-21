import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'
import { routedStream } from '@/lib/llm/router'
import { logLLMUsage } from '@/lib/llm/log'

const EDIT_SYSTEM = `You are an expert code editor. The user will give you a file's current content and an instruction.
Return ONLY the complete updated file content — no markdown fences, no explanation, no commentary.
Preserve the file's language, indentation style, and structure. Only make the changes requested.`

function buildDiff(oldContent: string, newContent: string, filePath: string): string {
  const oldLines = oldContent.split('\n')
  const newLines = newContent.split('\n')
  const lines: string[] = [`--- a/${filePath}`, `+++ b/${filePath}`]

  // Simple line-by-line diff (good enough for display)
  let i = 0, j = 0
  while (i < oldLines.length || j < newLines.length) {
    if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
      lines.push(` ${oldLines[i]}`)
      i++; j++
    } else {
      const oldChunk: string[] = []
      const newChunk: string[] = []
      while (i < oldLines.length && (j >= newLines.length || oldLines[i] !== newLines[j])) {
        oldChunk.push(oldLines[i++])
      }
      while (j < newLines.length && (i >= oldLines.length || oldLines[i] !== newLines[j])) {
        newChunk.push(newLines[j++])
      }
      if (oldChunk.length || newChunk.length) {
        lines.push(`@@ -${i - oldChunk.length + 1},${oldChunk.length} +${j - newChunk.length + 1},${newChunk.length} @@`)
        oldChunk.forEach(l => lines.push(`-${l}`))
        newChunk.forEach(l => lines.push(`+${l}`))
      }
    }
  }

  return lines.join('\n')
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

  const { projectId, filePath, instruction, currentContent } = await req.json()
  if (!projectId || !filePath || !instruction) {
    return new Response(JSON.stringify({ error: 'projectId, filePath, and instruction required' }), { status: 400 })
  }

  const project = await prisma.project.findFirst({ where: { id: projectId, userId: session.user.id } })
  if (!project) return new Response(JSON.stringify({ error: 'Project not found' }), { status: 404 })

  const fileContent = currentContent || ''
  const userPrompt = `File: ${filePath}\n\nCurrent content:\n\`\`\`\n${fileContent}\n\`\`\`\n\nInstruction: ${instruction}`

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))

      try {
        let newContent = ''
        const { model, inputTokens, outputTokens } = await routedStream(
          [{ role: 'user', content: userPrompt }],
          EDIT_SYSTEM,
          'high',
          (chunk) => {
            newContent += chunk
            send({ type: 'chunk', text: chunk })
          }
        )

        // Persist updated file
        await prisma.projectFile.updateMany({
          where: { projectId, path: filePath },
          data: { content: newContent },
        })

        logLLMUsage({ userId: session.user.id, projectId, model, feature: 'file-edit', inputTokens, outputTokens })

        const diff = buildDiff(fileContent, newContent, filePath)
        send({ type: 'complete', content: newContent, diff })
      } catch (err: any) {
        send({ type: 'error', message: err.message || 'Edit failed' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  })
}
