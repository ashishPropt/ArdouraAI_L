import OpenAI from 'openai'
import type { LLMMessage, LLMResult } from './anthropic'

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
): Promise<LLMResult> {
  const c = getClient()
  let fullText = ''
  let inputTokens = 0
  let outputTokens = 0

  const stream = await c.chat.completions.create({
    model,
    stream: true,
    stream_options: { include_usage: true },
    messages: [{ role: 'system', content: systemPrompt }, ...messages],
  })

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content || ''
    if (text) { fullText += text; onChunk(text) }
    if (chunk.usage) { inputTokens = chunk.usage.prompt_tokens; outputTokens = chunk.usage.completion_tokens }
  }

  return { text: fullText, inputTokens, outputTokens }
}

export async function generateWithOpenAI(
  messages: LLMMessage[],
  systemPrompt: string,
  model: 'gpt-4o' | 'gpt-4o-mini' = 'gpt-4o-mini'
): Promise<LLMResult> {
  const c = getClient()
  const response = await c.chat.completions.create({
    model,
    messages: [{ role: 'system', content: systemPrompt }, ...messages],
  })
  return {
    text: response.choices[0]?.message?.content || '',
    inputTokens: response.usage?.prompt_tokens ?? 0,
    outputTokens: response.usage?.completion_tokens ?? 0,
  }
}
