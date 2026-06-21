import type { MCPToolResult } from '../registry'

interface DTConfig {
  baseUrl: string
  apiToken: string
}

async function dtFetch(path: string, cfg: DTConfig, options?: RequestInit) {
  const res = await fetch(`${cfg.baseUrl.replace(/\/$/, '')}/api/v2${path}`, {
    ...options,
    headers: {
      Authorization: `Api-Token ${cfg.apiToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message ?? `Dynatrace error ${res.status}`)
  return data
}

export async function dynatraceTool(
  action: string,
  params: Record<string, unknown>,
  config: Record<string, unknown>
): Promise<MCPToolResult> {
  const cfg = config as DTConfig

  switch (action) {
    case 'get_problems': {
      const status = (params.status as string) ?? 'OPEN'
      const data = await dtFetch(`/problems?problemSelector=status("${status}")&pageSize=20`, cfg)
      return { success: true, data: data.problems?.map((p: any) => ({ id: p.problemId, title: p.title, severity: p.severityLevel, status: p.status, startTime: p.startTime, affectedEntities: p.affectedEntities?.length })) }
    }

    case 'get_metrics': {
      const res = (params.resolution as string) ?? '1m'
      const from = 'now-1h'
      const data = await dtFetch(`/metrics/query?metricSelector=${encodeURIComponent(params.metricSelector as string)}&resolution=${res}&from=${from}`, cfg)
      return { success: true, data: data.result?.map((r: any) => ({ metricId: r.metricId, data: r.data?.slice(-20) })) }
    }

    case 'get_events': {
      const from = (params.from as string) ?? 'now-1h'
      const data = await dtFetch(`/events?from=${from}&pageSize=20`, cfg)
      return { success: true, data: data.events?.map((e: any) => ({ eventId: e.eventId, title: e.title, eventType: e.eventType, startTime: e.startTime, entityId: e.entityId?.entityId })) }
    }

    default:
      return { success: false, error: `Unknown Dynatrace action: ${action}` }
  }
}
