import type { LLMMessage } from './providers/anthropic'
import { streamWithClaude, generateWithClaude } from './providers/anthropic'
import { streamWithOpenAI, generateWithOpenAI } from './providers/openai'
import { streamWithGemini, generateWithGemini } from './providers/gemini'

export type TaskComplexity = 'low' | 'medium' | 'high'

// Cost per 1M tokens (input/output avg) in USD
const PROVIDER_COSTS = {
  'claude-haiku-4-5-20251001': 0.40,
  'claude-sonnet-4-6': 3.00,
  'gpt-4o-mini': 0.30,
  'gpt-4o': 5.00,
  'gemini-1.5-flash': 0.075,
  'gemini-1.5-pro': 1.25,
} as const

type ModelKey = keyof typeof PROVIDER_COSTS

function selectModel(complexity: TaskComplexity): ModelKey {
  const hasOpenAI = !!process.env.OPENAI_API_KEY
  const hasGemini = !!process.env.GOOGLE_GEMINI_API_KEY

  if (complexity === 'low') {
    if (hasGemini) return 'gemini-1.5-flash'
    if (hasOpenAI) return 'gpt-4o-mini'
    return 'claude-haiku-4-5-20251001'
  }

  if (complexity === 'medium') {
    if (hasGemini) return 'gemini-1.5-flash'
    if (hasOpenAI) return 'gpt-4o-mini'
    return 'claude-sonnet-4-6'
  }

  // high complexity — best quality
  return 'claude-sonnet-4-6'
}

export async function routedStream(
  messages: LLMMessage[],
  systemPrompt: string,
  complexity: TaskComplexity,
  onChunk: (text: string) => void
): Promise<{ text: string; model: ModelKey }> {
  const model = selectModel(complexity)

  let text: string

  if (model.startsWith('claude')) {
    text = await streamWithClaude(messages, systemPrompt, model as any, onChunk)
  } else if (model.startsWith('gpt')) {
    text = await streamWithOpenAI(messages, systemPrompt, model as any, onChunk)
  } else {
    text = await streamWithGemini(messages, systemPrompt, model as any, onChunk)
  }

  return { text, model }
}

export async function routedGenerate(
  messages: LLMMessage[],
  systemPrompt: string,
  complexity: TaskComplexity
): Promise<{ text: string; model: ModelKey }> {
  const model = selectModel(complexity)

  let text: string

  if (model.startsWith('claude')) {
    text = await generateWithClaude(messages, systemPrompt, model as any)
  } else if (model.startsWith('gpt')) {
    text = await generateWithOpenAI(messages, systemPrompt, model as any)
  } else {
    text = await generateWithGemini(messages, systemPrompt, model as any)
  }

  return { text, model }
}

export function getModelInfo(model: ModelKey) {
  return {
    model,
    costPer1MTokens: PROVIDER_COSTS[model],
    provider: model.startsWith('claude') ? 'Anthropic' : model.startsWith('gpt') ? 'OpenAI' : 'Google',
  }
}
