import { prisma } from '@/lib/db/prisma'
import { routeLLM } from '@/lib/llm/router'
import type { WorkflowStep } from '@prisma/client'

interface StepResult {
  success: boolean
  output: unknown
  error?: string
  durationMs: number
}

function interpolate(template: string, context: Record<string, unknown>): string {
  return template.replace(/\{\{([\w.]+)\}\}/g, (_, path: string) => {
    const val = resolveField(path, context)
    return val !== undefined ? String(val) : `{{${path}}}`
  })
}

function resolveField(path: string, context: Record<string, unknown>): unknown {
  return path.split('.').reduce((obj: unknown, key) => {
    if (obj && typeof obj === 'object') return (obj as Record<string, unknown>)[key]
    return undefined
  }, context as unknown)
}

function evalCondition(left: unknown, operator: string, right: unknown): boolean {
  switch (operator) {
    case 'eq':       return String(left) === String(right)
    case 'neq':      return String(left) !== String(right)
    case 'gt':       return Number(left) > Number(right)
    case 'lt':       return Number(left) < Number(right)
    case 'gte':      return Number(left) >= Number(right)
    case 'lte':      return Number(left) <= Number(right)
    case 'contains': return String(left).includes(String(right))
    case 'truthy':   return Boolean(left)
    default:         return false
  }
}

async function executeStep(
  step: WorkflowStep,
  context: Record<string, unknown>
): Promise<StepResult> {
  const start = Date.now()
  const config = step.config as Record<string, unknown>

  try {
    let output: unknown

    switch (step.type) {
      case 'LLM_GENERATE': {
        const prompt = interpolate((config.prompt as string) ?? '', context)
        const model = config.model as string | undefined
        const result = await routeLLM([{ role: 'user', content: prompt }], model)
        output = { text: result.text, model: result.model, inputTokens: result.inputTokens, outputTokens: result.outputTokens }
        break
      }

      case 'HTTP_REQUEST': {
        const url = interpolate((config.url as string) ?? '', context)
        const method = ((config.method as string) ?? 'GET').toUpperCase()
        const rawHeaders = config.headers as Record<string, string> | undefined
        const rawBody = config.body
        const bodyStr = rawBody ? interpolate(JSON.stringify(rawBody), context) : undefined
        const controller = new AbortController()
        const tid = setTimeout(() => controller.abort(), 15000)
        const res = await fetch(url, {
          method,
          headers: rawHeaders,
          body: bodyStr,
          signal: controller.signal,
        })
        clearTimeout(tid)
        const text = await res.text()
        let parsed: unknown = text
        try { parsed = JSON.parse(text) } catch {}
        output = { status: res.status, ok: res.ok, body: parsed }
        break
      }

      case 'CONDITION': {
        const left = resolveField((config.left as string) ?? '', context)
        const operator = (config.operator as string) ?? 'eq'
        const right = config.right
        const result = evalCondition(left, operator, right)
        output = { result, left, right, operator }
        break
      }

      case 'NOTIFY': {
        const message = interpolate((config.message as string) ?? '', context)
        // Actual Slack delivery would require an integration lookup here
        output = { queued: true, message, channel: config.channel ?? '#general' }
        break
      }

      case 'TRANSFORM': {
        const field = (config.field as string) ?? ''
        output = { value: resolveField(field, context) }
        break
      }

      default:
        output = { skipped: true, type: step.type }
    }

    return { success: true, output, durationMs: Date.now() - start }
  } catch (err) {
    return { success: false, output: null, error: String(err), durationMs: Date.now() - start }
  }
}

export async function executeWorkflow(
  workflowId: string,
  triggeredBy: string,
  input: Record<string, unknown> = {}
): Promise<string> {
  const workflow = await prisma.workflow.findUnique({
    where: { id: workflowId },
    include: { steps: { orderBy: { stepOrder: 'asc' } } },
  })
  if (!workflow) throw new Error('Workflow not found')

  const run = await prisma.workflowRun.create({
    data: { workflowId, status: 'RUNNING', triggeredBy, input },
  })

  const context: Record<string, unknown> = { input, steps: {} as Record<string, unknown> }
  let runStatus: 'COMPLETED' | 'FAILED' = 'COMPLETED'
  let finalOutput: unknown = null
  let runError: string | undefined

  for (const step of workflow.steps) {
    const result = await executeStep(step, context)

    await prisma.workflowRunLog.create({
      data: {
        runId: run.id,
        stepId: step.id,
        stepName: step.name,
        status: result.success ? 'SUCCESS' : 'FAILED',
        input: context as Record<string, unknown>,
        output: result.output as Record<string, unknown>,
        error: result.error,
        durationMs: result.durationMs,
      },
    })

    ;(context.steps as Record<string, unknown>)[step.name] = result.output
    finalOutput = result.output

    if (!result.success) {
      runStatus = 'FAILED'
      runError = result.error
      break
    }
  }

  await prisma.workflowRun.update({
    where: { id: run.id },
    data: {
      status: runStatus,
      output: finalOutput as Record<string, unknown>,
      error: runError,
      completedAt: new Date(),
    },
  })

  await prisma.workflow.update({
    where: { id: workflowId },
    data: { lastRunAt: new Date() },
  })

  return run.id
}
