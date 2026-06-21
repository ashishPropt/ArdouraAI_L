import type { MCPToolResult } from '../registry'

interface GitHubConfig {
  token: string
  owner: string
  defaultRepo?: string
}

async function ghFetch(path: string, config: GitHubConfig, options?: RequestInit) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message ?? `GitHub API error ${res.status}`)
  return data
}

export async function githubTool(
  action: string,
  params: Record<string, unknown>,
  config: Record<string, unknown>
): Promise<MCPToolResult> {
  const cfg = config as GitHubConfig
  const owner = cfg.owner
  const repo = (params.repo as string) ?? cfg.defaultRepo

  switch (action) {
    case 'get_recent_commits': {
      const n = (params.n as number) ?? 10
      const data = await ghFetch(`/repos/${owner}/${repo}/commits?per_page=${n}`, cfg)
      return { success: true, data: data.map((c: any) => ({ sha: c.sha.slice(0,7), message: c.commit.message.split('\n')[0], author: c.commit.author.name, date: c.commit.author.date })) }
    }

    case 'get_file_content': {
      const ref = (params.ref as string) ?? 'HEAD'
      const data = await ghFetch(`/repos/${owner}/${repo}/contents/${params.path}?ref=${ref}`, cfg)
      const content = Buffer.from(data.content, 'base64').toString('utf8')
      return { success: true, data: { path: data.path, sha: data.sha, content } }
    }

    case 'list_open_prs': {
      const data = await ghFetch(`/repos/${owner}/${repo}/pulls?state=open&per_page=20`, cfg)
      return { success: true, data: data.map((pr: any) => ({ number: pr.number, title: pr.title, author: pr.user.login, branch: pr.head.ref, createdAt: pr.created_at })) }
    }

    case 'create_pull_request': {
      const data = await ghFetch(`/repos/${owner}/${repo}/pulls`, cfg, {
        method: 'POST',
        body: JSON.stringify({ title: params.title, body: params.body, head: params.head, base: params.base ?? 'main' }),
      })
      return { success: true, data: { number: data.number, url: data.html_url, title: data.title } }
    }

    case 'push_file': {
      // Get current file SHA if it exists
      let sha: string | undefined
      try {
        const existing = await ghFetch(`/repos/${owner}/${repo}/contents/${params.path}?ref=${params.branch}`, cfg)
        sha = existing.sha
      } catch { /* new file */ }

      const body: Record<string, unknown> = {
        message: params.message,
        content: Buffer.from(params.content as string).toString('base64'),
        branch: params.branch,
      }
      if (sha) body.sha = sha

      const data = await ghFetch(`/repos/${owner}/${repo}/contents/${params.path}`, cfg, {
        method: 'PUT',
        body: JSON.stringify(body),
      })
      return { success: true, data: { sha: data.content.sha, path: data.content.path, commitSha: data.commit.sha } }
    }

    default:
      return { success: false, error: `Unknown GitHub action: ${action}` }
  }
}
