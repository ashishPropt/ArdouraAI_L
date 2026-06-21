import type { MCPToolResult } from '../registry'

interface SNConfig {
  instance: string
  username: string
  password: string
}

async function snFetch(path: string, cfg: SNConfig, options?: RequestInit) {
  const auth = Buffer.from(`${cfg.username}:${cfg.password}`).toString('base64')
  const base = `https://${cfg.instance}.service-now.com/api/now`
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message ?? `ServiceNow error ${res.status}`)
  return data.result
}

export async function servicenowTool(
  action: string,
  params: Record<string, unknown>,
  config: Record<string, unknown>
): Promise<MCPToolResult> {
  const cfg = config as SNConfig

  switch (action) {
    case 'create_incident': {
      const data = await snFetch('/table/incident', cfg, {
        method: 'POST',
        body: JSON.stringify({
          short_description: params.short_description,
          description: params.description ?? '',
          urgency: params.urgency ?? '2',
          impact: params.impact ?? '2',
          caller_id: cfg.username,
        }),
      })
      return { success: true, data: { sysId: data.sys_id, number: data.number, state: data.state } }
    }

    case 'update_incident': {
      const body: Record<string, unknown> = {}
      if (params.work_notes) body.work_notes = params.work_notes
      if (params.state) body.state = params.state
      const data = await snFetch(`/table/incident/${params.sysId}`, cfg, {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
      return { success: true, data: { sysId: data.sys_id, state: data.state, number: data.number } }
    }

    case 'resolve_incident': {
      const data = await snFetch(`/table/incident/${params.sysId}`, cfg, {
        method: 'PATCH',
        body: JSON.stringify({ state: '6', close_notes: params.resolution, close_code: 'Solved (Permanently)' }),
      })
      return { success: true, data: { sysId: data.sys_id, state: data.state } }
    }

    case 'create_change': {
      const data = await snFetch('/table/change_request', cfg, {
        method: 'POST',
        body: JSON.stringify({
          short_description: params.short_description,
          description: params.description ?? '',
          type: params.type ?? 'normal',
          requested_by: cfg.username,
        }),
      })
      return { success: true, data: { sysId: data.sys_id, number: data.number, state: data.state } }
    }

    default:
      return { success: false, error: `Unknown ServiceNow action: ${action}` }
  }
}
