import type { LLMMessage, LLMResult } from './providers/anthropic'
import { streamWithClaude, generateWithClaude } from './providers/anthropic'
import { streamWithOpenAI, generateWithOpenAI } from './providers/openai'
import { streamWithGemini, generateWithGemini } from './providers/gemini'

export type TaskComplexity = 'low' | 'medium' | 'high'

const PROVIDER_COSTS: Record<string, number> = {
  'claude-haiku-4-5-20251001': 0.40,
  'claude-sonnet-4-6': 3.00,
  'gpt-4o-mini': 0.30,
  'gpt-4o': 5.00,
  'gemini-1.5-flash': 0.075,
  'gemini-1.5-pro': 1.25,
}

function selectModel(complexity: TaskComplexity): string {
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
  return 'claude-sonnet-4-6'
}

export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const rate = PROVIDER_COSTS[model] ?? 1.0
  return ((inputTokens + outputTokens) / 1_000_000) * rate
}

export async function routedStream(
  messages: LLMMessage[],
  systemPrompt: string,
  complexity: TaskComplexity,
  onChunk: (text: string) => void
): Promise<{ text: string; model: string; inputTokens: number; outputTokens: number }> {
  const model = selectModel(complexity)
  let result: LLMResult

  if (model.startsWith('claude')) {
    result = await streamWithClaude(messages, systemPrompt, model as any, onChunk)
  } else if (model.startsWith('gpt')) {
    result = await streamWithOpenAI(messages, systemPrompt, model as any, onChunk)
  } else {
    result = await streamWithGemini(messages, systemPrompt, model as any, onChunk)
  }

  return { ...result, model }
}

export async function routedGenerate(
  messages: LLMMessage[],
  systemPrompt: string,
  complexity: TaskComplexity
): Promise<{ text: string; model: string; inputTokens: number; outputTokens: number }> {
  const model = selectModel(complexity)
  let result: LLMResult

  if (model.startsWith('claude')) {
    result = await generateWithClaude(messages, systemPrompt, model as any)
  } else if (model.startsWith('gpt')) {
    result = await generateWithOpenAI(messages, systemPrompt, model as any)
  } else {
    result = await generateWithGemini(messages, systemPrompt, model as any)
  }

  return { ...result, model }
}

export function getModelInfo(model: string) {
  return {
    model,
    costPer1MTokens: PROVIDER_COSTS[model] ?? 0,
    provider: model.startsWith('claude') ? 'anthropic' : model.startsWith('gpt') ? 'openai' : 'google',
  }
}

export { type LLMMessage }
