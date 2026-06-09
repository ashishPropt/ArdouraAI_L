import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface LLMMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function streamWithClaude(
  messages: LLMMessage[],
  systemPrompt: string,
  model: 'claude-sonnet-4-6' | 'claude-haiku-4-5-20251001' = 'claude-sonnet-4-6',
  onChunk: (text: string) => void
): Promise<string> {
  let fullText = ''

  const stream = await client.messages.stream({
    model,
    max_tokens: 8096,
    system: systemPrompt,
    messages,
  })

  for await (const chunk of stream) {
    if (
      chunk.type === 'content_block_delta' &&
      chunk.delta.type === 'text_delta'
    ) {
      fullText += chunk.delta.text
      onChunk(chunk.delta.text)
    }
  }

  return fullText
}

export async function generateWithClaude(
  messages: LLMMessage[],
  systemPrompt: string,
  model: 'claude-sonnet-4-6' | 'claude-haiku-4-5-20251001' = 'claude-sonnet-4-6'
): Promise<string> {
  const response = await client.messages.create({
    model,
    max_tokens: 8096,
    system: systemPrompt,
    messages,
  })

  return response.content[0].type === 'text' ? response.content[0].text : ''
}
