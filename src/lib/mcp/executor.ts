import { TOOL_REGISTRY, type MCPToolCall, type MCPToolResult } from './registry'
import { decryptObject } from '@/lib/vault/encrypt'
import { prisma } from '@/lib/db/prisma'
import { githubTool } from './tools/github'
import { jiraTool } from './tools/jira'
import { confluenceTool } from './tools/confluence'
import { servicenowTool } from './tools/servicenow'
import { datadogTool } from './tools/datadog'
import { dynatraceTool } from './tools/dynatrace'
import { vultrTool } from './tools/vultr'
import { slackTool } from './tools/slack'
import { databaseTool } from './tools/database'
import type { IntegrationType } from '@prisma/client'

type ToolExecutor = (action: string, params: Record<string, unknown>, config: Record<string, unknown>) => Promise<MCPToolResult>

const EXECUTORS: Record<string, ToolExecutor> = {
  GITHUB:      githubTool,
  JIRA:        jiraTool,
  CONFLUENCE:  confluenceTool,
  SERVICENOW:  servicenowTool,
  DATADOG:     datadogTool,
  DYNATRACE:   dynatraceTool,
  VULTR:       vultrTool,
  SLACK:       slackTool,
  DATABASE:    databaseTool,
}

export interface ExecutionContext {
  projectId: string
  userId?: string
  bypassHITL?: boolean  // only set for system-approved actions
}

export interface ExecutionResult extends MCPToolResult {
  requiresHITL?: boolean
  riskLevel?: string
  toolName?: string
  action?: string
}

export async function executeTool(
  call: MCPToolCall,
  ctx: ExecutionContext
): Promise<ExecutionResult> {
  const toolDef = TOOL_REGISTRY[call.tool]
  if (!toolDef) {
    return { success: false, error: `Unknown tool: ${call.tool}` }
  }

  const actionDef = toolDef.actions[call.action]
  if (!actionDef) {
    return { success: false, error: `Unknown action: ${call.action} for tool ${call.tool}` }
  }

  // HITL gate — block high-risk actions unless explicitly bypassed
  if (actionDef.requiresHITL && !ctx.bypassHITL) {
    return {
      success: false,
      requiresHITL: true,
      riskLevel: actionDef.riskLevel,
      toolName: toolDef.name,
      action: call.action,
      error: `Action "${call.action}" on ${toolDef.name} requires human approval (risk: ${actionDef.riskLevel})`,
    }
  }

  // Load integration config from vault
  let config: Record<string, unknown> = {}
  if (call.integrationId) {
    const row = await prisma.integration.findUnique({ where: { id: call.integrationId } })
    if (row) {
      try { config = decryptObject<Record<string, unknown>>(row.config) } catch {}
    }
  }

  const executor = EXECUTORS[call.tool]
  if (!executor) {
    return { success: false, error: `No executor registered for tool: ${call.tool}` }
  }

  try {
    return await executor(call.action, call.params, config)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, error: msg }
  }
}

export function getToolDef(tool: IntegrationType) {
  return TOOL_REGISTRY[tool] ?? null
}

export function listTools() {
  return Object.values(TOOL_REGISTRY).map(t => ({
    type: t.type,
    name: t.name,
    description: t.description,
    actions: Object.keys(t.actions),
  }))
}
