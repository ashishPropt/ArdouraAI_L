import OpenAI from 'openai'
import type { LLMMessage } from './anthropic'

let client: OpenAI | null = null

function getClient() {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set')
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return client
}

export async function streamWithOpenAI(
  messages: LLMMessage[],
  systemPrompt: string,
  model: 'gpt-4o' | 'gpt-4o-mini' | 'gpt-3.5-turbo' = 'gpt-4o-mini',
  onChunk: (text: string) => void
): Promise<string> {
  const c = getClient()
  let fullText = ''

  const stream = await c.chat.completions.create({
    model,
    stream: true,
    messages: [{ role: 'system', content: systemPrompt }, ...messages],
  })

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content || ''
    if (text) {
      fullText += text
      onChunk(text)
    }
  }

  return fullText
}

export async function generateWithOpenAI(
  messages: LLMMessage[],
  systemPrompt: string,
  model: 'gpt-4o' | 'gpt-4o-mini' = 'gpt-4o-mini'
): Promise<string> {
  const c = getClient()
  const response = await c.chat.completions.create({
    model,
    messages: [{ role: 'system', content: systemPrompt }, ...messages],
  })
  return response.choices[0]?.message?.content || ''
}
