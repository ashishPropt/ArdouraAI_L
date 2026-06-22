import axios from 'axios'

// ── Twitter/X ──────────────────────────────────────────────────────────────

interface TwitterConfig { bearerToken: string; apiKey: string; apiSecret: string; accessToken: string; accessSecret: string }

export async function executeTwitter(action: string, params: Record<string, unknown>, config: TwitterConfig) {
  const client = axios.create({
    baseURL: 'https://api.twitter.com/2',
    headers: { Authorization: `Bearer ${config.bearerToken}` },
    timeout: 15_000,
  })
  switch (action) {
    case 'post_tweet': {
      const res = await client.post('/tweets', { text: params.text })
      return { success: true, data: { tweetId: res.data.data?.id, text: params.text } }
    }
    case 'post_thread': {
      const tweets = params.tweets as string[]
      let replyTo: string | undefined
      const ids: string[] = []
      for (const text of tweets) {
        const body: Record<string, unknown> = { text }
        if (replyTo) body.reply = { in_reply_to_tweet_id: replyTo }
        const res = await client.post('/tweets', body)
        replyTo = res.data.data?.id
        ids.push(replyTo!)
      }
      return { success: true, data: { threadIds: ids, count: ids.length } }
    }
    case 'get_mentions': {
      const res = await client.get('/tweets/search/recent', { params: { query: params.query, max_results: params.maxResults ?? 10 } })
      return { success: true, data: res.data.data ?? [] }
    }
    default:
      return { success: false, error: `Unknown Twitter action: ${action}` }
  }
}

// ── LinkedIn ───────────────────────────────────────────────────────────────

interface LinkedInConfig { accessToken: string; personUrn: string }

export async function executeLinkedIn(action: string, params: Record<string, unknown>, config: LinkedInConfig) {
  const client = axios.create({
    baseURL: 'https://api.linkedin.com/v2',
    headers: { Authorization: `Bearer ${config.accessToken}`, 'LinkedIn-Version': '202401' },
    timeout: 15_000,
  })
  switch (action) {
    case 'post_update': {
      const body = {
        author: `urn:li:person:${config.personUrn}`,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: { text: params.text },
            shareMediaCategory: 'NONE',
          },
        },
        visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
      }
      const res = await client.post('/ugcPosts', body)
      return { success: true, data: { postId: res.data.id } }
    }
    case 'get_profile': {
      const res = await client.get('/me')
      return { success: true, data: res.data }
    }
    default:
      return { success: false, error: `Unknown LinkedIn action: ${action}` }
  }
}

// ── Reddit ─────────────────────────────────────────────────────────────────

interface RedditConfig { clientId: string; clientSecret: string; username: string; password: string }

export async function executeReddit(action: string, params: Record<string, unknown>, config: RedditConfig) {
  // Get access token
  const tokenRes = await axios.post(
    'https://www.reddit.com/api/v1/access_token',
    `grant_type=password&username=${encodeURIComponent(config.username)}&password=${encodeURIComponent(config.password)}`,
    { auth: { username: config.clientId, password: config.clientSecret }, headers: { 'User-Agent': 'ArdouraAI/1.0' } }
  )
  const token = tokenRes.data.access_token
  const client = axios.create({
    baseURL: 'https://oauth.reddit.com',
    headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'ArdouraAI/1.0' },
  })
  switch (action) {
    case 'submit_post': {
      const res = await client.post('/api/submit', null, {
        params: { sr: params.subreddit, kind: 'self', title: params.title, text: params.text, resubmit: true },
      })
      return { success: true, data: { url: res.data?.json?.data?.url, id: res.data?.json?.data?.id } }
    }
    case 'search_subreddits': {
      const res = await client.get('/subreddits/search', { params: { q: params.query, limit: 10 } })
      return { success: true, data: (res.data?.data?.children ?? []).map((c: any) => ({ name: c.data.display_name, subscribers: c.data.subscribers, description: c.data.public_description })) }
    }
    default:
      return { success: false, error: `Unknown Reddit action: ${action}` }
  }
}

// ── Email / Loops ──────────────────────────────────────────────────────────

interface LoopsConfig { apiKey: string }

export async function executeLoops(action: string, params: Record<string, unknown>, config: LoopsConfig) {
  const client = axios.create({
    baseURL: 'https://app.loops.so/api/v1',
    headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
  })
  switch (action) {
    case 'send_transactional': {
      const res = await client.post('/transactional', { transactionalId: params.templateId, email: params.email, dataVariables: params.variables ?? {} })
      return { success: true, data: res.data }
    }
    case 'create_contact': {
      const res = await client.post('/contacts/create', { email: params.email, firstName: params.firstName, lastName: params.lastName, source: 'ArdouraAI' })
      return { success: true, data: res.data }
    }
    case 'send_event': {
      const res = await client.post('/events/send', { email: params.email, eventName: params.eventName, eventProperties: params.properties ?? {} })
      return { success: true, data: res.data }
    }
    default:
      return { success: false, error: `Unknown Loops action: ${action}` }
  }
}

// ── Product Hunt ───────────────────────────────────────────────────────────

interface PHConfig { accessToken: string }

export async function executeProductHunt(action: string, params: Record<string, unknown>, config: PHConfig) {
  const query = action === 'get_upcoming' ? `{ posts(order: NEWEST, first: 10) { edges { node { id name tagline votesCount } } } }` : `{ me { id name } }`
  const res = await axios.post(
    'https://api.producthunt.com/v2/api/graphql',
    { query },
    { headers: { Authorization: `Bearer ${config.accessToken}`, 'Content-Type': 'application/json' } }
  )
  return { success: true, data: res.data?.data }
}
