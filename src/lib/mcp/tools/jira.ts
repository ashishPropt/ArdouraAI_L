import type { MCPToolResult } from '../registry'

interface JiraConfig {
  baseUrl: string
  email: string
  apiToken: string
  project: string
}

async function jiraFetch(path: string, cfg: JiraConfig, options?: RequestInit) {
  const auth = Buffer.from(`${cfg.email}:${cfg.apiToken}`).toString('base64')
  const res = await fetch(`${cfg.baseUrl.replace(/\/$/, '')}/rest/api/3${path}`, {
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
  if (!res.ok) throw new Error(data.errorMessages?.join(', ') ?? `Jira API error ${res.status}`)
  return data
}

export async function jiraTool(
  action: string,
  params: Record<string, unknown>,
  config: Record<string, unknown>
): Promise<MCPToolResult> {
  const cfg = config as JiraConfig

  switch (action) {
    case 'create_issue': {
      const data = await jiraFetch('/issue', cfg, {
        method: 'POST',
        body: JSON.stringify({
          fields: {
            project: { key: cfg.project },
            summary: params.summary,
            description: params.description ? { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: params.description }] }] } : undefined,
            issuetype: { name: (params.issuetype as string) ?? 'Task' },
            priority: params.priority ? { name: params.priority } : undefined,
          },
        }),
      })
      return { success: true, data: { key: data.key, id: data.id, url: `${cfg.baseUrl}/browse/${data.key}` } }
    }

    case 'update_issue': {
      const issueKey = params.issueKey as string
      if (params.comment) {
        await jiraFetch(`/issue/${issueKey}/comment`, cfg, {
          method: 'POST',
          body: JSON.stringify({ body: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: params.comment }] }] } }),
        })
      }
      if (params.status) {
        // Get available transitions
        const { transitions } = await jiraFetch(`/issue/${issueKey}/transitions`, cfg)
        const t = (transitions as any[]).find(x => x.name.toLowerCase().includes((params.status as string).toLowerCase()))
        if (t) {
          await jiraFetch(`/issue/${issueKey}/transitions`, cfg, {
            method: 'POST',
            body: JSON.stringify({ transition: { id: t.id } }),
          })
        }
      }
      return { success: true, data: { key: issueKey, updated: true } }
    }

    case 'close_issue': {
      const issueKey = params.issueKey as string
      const { transitions } = await jiraFetch(`/issue/${issueKey}/transitions`, cfg)
      const done = (transitions as any[]).find(x => x.name.toLowerCase().includes('done') || x.name.toLowerCase().includes('closed') || x.name.toLowerCase().includes('resolved'))
      if (!done) return { success: false, error: 'Could not find a "Done" transition' }
      await jiraFetch(`/issue/${issueKey}/transitions`, cfg, {
        method: 'POST',
        body: JSON.stringify({ transition: { id: done.id } }),
      })
      if (params.resolution) {
        await jiraFetch(`/issue/${issueKey}/comment`, cfg, {
          method: 'POST',
          body: JSON.stringify({ body: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: params.resolution as string }] }] } }),
        })
      }
      return { success: true, data: { key: issueKey, closed: true } }
    }

    case 'search_issues': {
      const data = await jiraFetch(`/search?jql=${encodeURIComponent(params.jql as string)}&maxResults=${params.maxResults ?? 20}`, cfg)
      return { success: true, data: { total: data.total, issues: (data.issues as any[]).map(i => ({ key: i.key, summary: i.fields.summary, status: i.fields.status.name, priority: i.fields.priority?.name, assignee: i.fields.assignee?.displayName })) } }
    }

    default:
      return { success: false, error: `Unknown Jira action: ${action}` }
  }
}
