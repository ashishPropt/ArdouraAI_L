import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface LLMMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface LLMResult {
  text: string
  inputTokens: number
  outputTokens: number
}

export async function streamWithClaude(
  messages: LLMMessage[],
  systemPrompt: string,
  model: 'claude-sonnet-4-6' | 'claude-haiku-4-5-20251001' = 'claude-sonnet-4-6',
  onChunk: (text: string) => void
): Promise<LLMResult> {
  let fullText = ''
  let inputTokens = 0
  let outputTokens = 0

  const stream = await client.messages.stream({
    model,
    max_tokens: 8096,
    system: systemPrompt,
    messages,
  })

  for await (const chunk of stream) {
    if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
      fullText += chunk.delta.text
      onChunk(chunk.delta.text)
    }
    if (chunk.type === 'message_start') {
      inputTokens = chunk.message.usage.input_tokens
    }
    if (chunk.type === 'message_delta') {
      outputTokens = chunk.usage.output_tokens
    }
  }

  return { text: fullText, inputTokens, outputTokens }
}

export async function generateWithClaude(
  messages: LLMMessage[],
  systemPrompt: string,
  model: 'claude-sonnet-4-6' | 'claude-haiku-4-5-20251001' = 'claude-sonnet-4-6'
): Promise<LLMResult> {
  const response = await client.messages.create({
    model,
    max_tokens: 8096,
    system: systemPrompt,
    messages,
  })

  return {
    text: response.content[0].type === 'text' ? response.content[0].text : '',
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  }
}
