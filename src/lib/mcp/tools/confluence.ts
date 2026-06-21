import type { MCPToolResult } from '../registry'

interface ConfluenceConfig {
  baseUrl: string
  email: string
  apiToken: string
  spaceKey: string
}

async function cFetch(path: string, cfg: ConfluenceConfig, options?: RequestInit) {
  const auth = Buffer.from(`${cfg.email}:${cfg.apiToken}`).toString('base64')
  const res = await fetch(`${cfg.baseUrl.replace(/\/$/, '')}/wiki/rest/api${path}`, {
    ...options,
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
  })
  const text = await res.text()
  const data = text ? JSON.parse(text) : {}
  if (!res.ok) throw new Error(data.message ?? `Confluence API error ${res.status}`)
  return data
}

export async function confluenceTool(
  action: string,
  params: Record<string, unknown>,
  config: Record<string, unknown>
): Promise<MCPToolResult> {
  const cfg = config as ConfluenceConfig

  switch (action) {
    case 'create_page': {
      const body: Record<string, unknown> = {
        type: 'page',
        title: params.title,
        space: { key: cfg.spaceKey },
        body: { storage: { value: params.body, representation: 'storage' } },
      }
      if (params.parentId) body.ancestors = [{ id: params.parentId }]
      const data = await cFetch('/content', cfg, { method: 'POST', body: JSON.stringify(body) })
      return { success: true, data: { id: data.id, title: data.title, url: `${cfg.baseUrl}/wiki${data._links.webui}` } }
    }

    case 'update_page': {
      const current = await cFetch(`/content/${params.pageId}?expand=version`, cfg)
      const data = await cFetch(`/content/${params.pageId}`, cfg, {
        method: 'PUT',
        body: JSON.stringify({
          type: 'page',
          title: params.title ?? current.title,
          version: { number: current.version.number + 1 },
          body: { storage: { value: params.body, representation: 'storage' } },
        }),
      })
      return { success: true, data: { id: data.id, version: data.version.number } }
    }

    case 'get_page': {
      const data = await cFetch(`/content/${params.pageId}?expand=body.storage,version`, cfg)
      return { success: true, data: { id: data.id, title: data.title, body: data.body.storage.value, version: data.version.number } }
    }

    case 'search_pages': {
      const cql = `type=page AND space="${cfg.spaceKey}" AND text~"${params.query}"`
      const data = await cFetch(`/search?cql=${encodeURIComponent(cql)}&limit=${params.limit ?? 10}`, cfg)
      return { success: true, data: (data.results as any[]).map(r => ({ id: r.content.id, title: r.content.title, url: `${cfg.baseUrl}/wiki${r.content._links.webui}`, excerpt: r.excerpt })) }
    }

    default:
      return { success: false, error: `Unknown Confluence action: ${action}` }
  }
}
