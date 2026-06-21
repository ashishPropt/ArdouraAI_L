import type { MCPToolResult } from '../registry'

interface VultrConfig {
  apiKey: string
}

async function vFetch(path: string, cfg: VultrConfig, options?: RequestInit) {
  const res = await fetch(`https://api.vultr.com/v2${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
  })
  const text = await res.text()
  if (res.status === 204) return {}
  const data = text ? JSON.parse(text) : {}
  if (!res.ok) throw new Error(data.error ?? `Vultr error ${res.status}`)
  return data
}

export async function vultrTool(
  action: string,
  params: Record<string, unknown>,
  config: Record<string, unknown>
): Promise<MCPToolResult> {
  const cfg = config as VultrConfig

  switch (action) {
    case 'list_instances': {
      const data = await vFetch('/instances?per_page=50', cfg)
      return {
        success: true,
        data: data.instances?.map((i: any) => ({
          id: i.id, label: i.label, status: i.status, power: i.power_status,
          ip: i.main_ip, plan: i.plan, region: i.region,
          ram: i.ram, vcpu: i.vcpu_count, disk: i.disk,
          os: i.os, created: i.date_created,
        })),
      }
    }

    case 'get_metrics': {
      const data = await vFetch(`/instances/${params.instanceId}/bandwidth`, cfg)
      return { success: true, data: { instanceId: params.instanceId, bandwidth: data.bandwidth } }
    }

    case 'reboot_instance': {
      await vFetch(`/instances/${params.instanceId}/reboot`, cfg, { method: 'POST' })
      return { success: true, data: { instanceId: params.instanceId, action: 'reboot', status: 'initiated' } }
    }

    case 'create_instance': {
      const body = {
        region: (params.region as string) ?? 'ewr',
        plan: (params.plan as string) ?? 'vc2-1c-2gb',
        os_id: 1743, // Ubuntu 22.04 LTS
        label: params.label,
        hostname: params.label,
        backups: 'disabled',
      }
      const data = await vFetch('/instances', cfg, { method: 'POST', body: JSON.stringify(body) })
      return { success: true, data: { id: data.instance.id, label: data.instance.label, status: data.instance.status, ip: data.instance.main_ip } }
    }

    case 'resize_instance': {
      await vFetch(`/instances/${params.instanceId}`, cfg, {
        method: 'PATCH',
        body: JSON.stringify({ plan: params.plan }),
      })
      return { success: true, data: { instanceId: params.instanceId, newPlan: params.plan, status: 'resize_initiated' } }
    }

    case 'delete_instance': {
      await vFetch(`/instances/${params.instanceId}`, cfg, { method: 'DELETE' })
      return { success: true, data: { instanceId: params.instanceId, deleted: true } }
    }

    default:
      return { success: false, error: `Unknown Vultr action: ${action}` }
  }
}
