import type { MCPToolResult } from '../registry'

interface DDConfig {
  apiKey: string
  appKey: string
  site?: string
}

async function ddFetch(path: string, cfg: DDConfig, options?: RequestInit) {
  const site = cfg.site ?? 'datadoghq.com'
  const res = await fetch(`https://api.${site}${path}`, {
    ...options,
    headers: {
      'DD-API-KEY': cfg.apiKey,
      'DD-APPLICATION-KEY': cfg.appKey,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.errors?.join(', ') ?? `DataDog error ${res.status}`)
  return data
}

export async function datadogTool(
  action: string,
  params: Record<string, unknown>,
  config: Record<string, unknown>
): Promise<MCPToolResult> {
  const cfg = config as DDConfig

  switch (action) {
    case 'query_metrics': {
      const now = Math.floor(Date.now() / 1000)
      const from = (params.from as number) ?? now - 3600
      const to = (params.to as number) ?? now
      const data = await ddFetch(`/api/v1/query?from=${from}&to=${to}&query=${encodeURIComponent(params.query as string)}`, cfg)
      return { success: true, data: { series: data.series?.map((s: any) => ({ metric: s.metric, pointlist: s.pointlist?.slice(-20) })) } }
    }

    case 'get_logs': {
      const data = await ddFetch('/api/v2/logs/events/search', cfg, {
        method: 'POST',
        body: JSON.stringify({
          filter: { query: params.query, from: 'now-1h', to: 'now' },
          page: { limit: (params.limit as number) ?? 20 },
        }),
      })
      return { success: true, data: data.data?.map((l: any) => ({ id: l.id, message: l.attributes.message, status: l.attributes.status, timestamp: l.attributes.timestamp, service: l.attributes.service })) }
    }

    case 'list_active_alerts': {
      const data = await ddFetch('/api/v1/monitor?monitor_tags=*&with_downtimes=true', cfg)
      const active = (data as any[]).filter(m => m.overall_state !== 'OK')
      return { success: true, data: active.map(m => ({ id: m.id, name: m.name, state: m.overall_state, priority: m.priority, message: m.message?.slice(0, 200) })) }
    }

    case 'mute_alert': {
      const end = params.durationSecs ? Math.floor(Date.now() / 1000) + (params.durationSecs as number) : undefined
      const data = await ddFetch(`/api/v1/monitor/${params.monitorId}/mute`, cfg, {
        method: 'POST',
        body: JSON.stringify(end ? { end } : {}),
      })
      return { success: true, data: { id: (data as any).id, muted: true } }
    }

    default:
      return { success: false, error: `Unknown DataDog action: ${action}` }
  }
}
