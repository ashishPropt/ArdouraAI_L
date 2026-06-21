import type { LLMMessage, LLMResult } from './anthropic'

// Google Gemini via REST API
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

function getApiKey() {
  if (!process.env.GOOGLE_GEMINI_API_KEY) throw new Error('GOOGLE_GEMINI_API_KEY not set')
  return process.env.GOOGLE_GEMINI_API_KEY
}

function toGeminiMessages(messages: LLMMessage[], systemPrompt: string) {
  return {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
  }
}

export async function generateWithGemini(
  messages: LLMMessage[],
  systemPrompt: string,
  model: 'gemini-1.5-flash' | 'gemini-1.5-pro' = 'gemini-1.5-flash'
): Promise<LLMResult> {
  const key = getApiKey()
  const body = toGeminiMessages(messages, systemPrompt)

  const res = await fetch(`${GEMINI_BASE}/${model}:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, generationConfig: { maxOutputTokens: 8192 } }),
  })

  if (!res.ok) throw new Error(`Gemini error: ${res.status} ${await res.text()}`)

  const data = await res.json()
  return {
    text: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
    inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
  }
}

export async function streamWithGemini(
  messages: LLMMessage[],
  systemPrompt: string,
  model: 'gemini-1.5-flash' | 'gemini-1.5-pro' = 'gemini-1.5-flash',
  onChunk: (text: string) => void
): Promise<LLMResult> {
  const key = getApiKey()
  const body = toGeminiMessages(messages, systemPrompt)

  const res = await fetch(`${GEMINI_BASE}/${model}:streamGenerateContent?key=${key}&alt=sse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, generationConfig: { maxOutputTokens: 8192 } }),
  })

  if (!res.ok) throw new Error(`Gemini error: ${res.status}`)

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let fullText = ''
  let inputTokens = 0
  let outputTokens = 0
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const json = line.slice(6).trim()
      if (json === '[DONE]') continue
      try {
        const parsed = JSON.parse(json)
        const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text || ''
        if (text) { fullText += text; onChunk(text) }
        if (parsed.usageMetadata) {
          inputTokens = parsed.usageMetadata.promptTokenCount ?? 0
          outputTokens = parsed.usageMetadata.candidatesTokenCount ?? 0
        }
      } catch {}
    }
  }

  return { text: fullText, inputTokens, outputTokens }
}
