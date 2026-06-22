import { XMLParser } from 'fast-xml-parser'
import axios from 'axios'

export interface WPPost {
  id: number
  title: string
  slug: string
  content: string
  excerpt: string
  date: string
  status: string
  type: 'post' | 'page'
  categories: string[]
  tags: string[]
  featuredImageUrl?: string
  author: string
}

export interface WPCategory {
  id: number
  name: string
  slug: string
  description: string
  count: number
}

export interface WPTag {
  id: number
  name: string
  slug: string
}

export interface WPSite {
  title: string
  description: string
  url: string
  posts: WPPost[]
  pages: WPPost[]
  categories: WPCategory[]
  tags: WPTag[]
}

function cdata(val: any): string {
  if (!val) return ''
  if (typeof val === 'object' && val.__cdata !== undefined) return String(val.__cdata)
  return String(val)
}

export function parseWXR(xmlContent: string): WPSite {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    cdataPropName: '__cdata',
    allowBooleanAttributes: true,
    parseTagValue: false,
  })

  const result = parser.parse(xmlContent)
  const channel = result?.rss?.channel
  if (!channel) throw new Error('Invalid WordPress export file — no <channel> found')

  const site: WPSite = {
    title: cdata(channel.title) || '',
    description: cdata(channel.description) || '',
    url: cdata(channel['wp:base_site_url']) || cdata(channel.link) || '',
    posts: [],
    pages: [],
    categories: [],
    tags: [],
  }

  const rawCats = channel['wp:category']
    ? Array.isArray(channel['wp:category']) ? channel['wp:category'] : [channel['wp:category']]
    : []
  site.categories = rawCats.map((c: any) => ({
    id: Number(cdata(c['wp:term_id'])) || 0,
    name: cdata(c['wp:cat_name']),
    slug: cdata(c['wp:category_nicename']),
    description: cdata(c['wp:category_description']),
    count: 0,
  }))

  const rawTags = channel['wp:tag']
    ? Array.isArray(channel['wp:tag']) ? channel['wp:tag'] : [channel['wp:tag']]
    : []
  site.tags = rawTags.map((t: any) => ({
    id: Number(cdata(t['wp:term_id'])) || 0,
    name: cdata(t['wp:tag_name']),
    slug: cdata(t['wp:tag_slug']),
  }))

  const items = channel.item
    ? Array.isArray(channel.item) ? channel.item : [channel.item]
    : []

  for (const item of items) {
    const postType = cdata(item['wp:post_type'])
    const status = cdata(item['wp:status'])
    if (!['post', 'page'].includes(postType)) continue

    const itemCats = item.category
      ? Array.isArray(item.category) ? item.category : [item.category]
      : []
    const cats: string[] = []
    const tags: string[] = []
    for (const c of itemCats) {
      const domain = c['@_domain'] || ''
      const text = cdata(c) || (typeof c === 'string' ? c : '')
      if (domain === 'category') cats.push(text)
      else if (domain === 'post_tag') tags.push(text)
    }

    const post: WPPost = {
      id: Number(cdata(item['wp:post_id'])) || 0,
      title: cdata(item.title),
      slug: cdata(item['wp:post_name']),
      content: cdata(item['content:encoded']),
      excerpt: cdata(item['excerpt:encoded']),
      date: cdata(item['wp:post_date']) || cdata(item.pubDate),
      status,
      type: postType as 'post' | 'page',
      categories: cats,
      tags,
      author: cdata(item['dc:creator']),
    }

    if (postType === 'post') site.posts.push(post)
    else site.pages.push(post)
  }

  // Filter to only published items
  site.posts = site.posts.filter(p => p.status === 'publish')
  site.pages = site.pages.filter(p => p.status === 'publish')

  return site
}

export async function fetchFromWPAPI(siteUrl: string): Promise<WPSite> {
  // Normalise: strip trailing slash and /wp-json path, then ensure protocol
  let base = siteUrl.trim().replace(/\/$/, '').replace(/\/wp-json(\/.*)?$/, '')
  if (!/^https?:\/\//i.test(base)) base = `https://${base}`

  // Try https first, fall back to http if connection refused / cert error
  let api = `${base}/wp-json/wp/v2`
  let testRes = await axios.get(`${base}/wp-json`, { timeout: 10000 }).catch(async (err) => {
    if (base.startsWith('https://')) {
      const httpBase = base.replace('https://', 'http://')
      return axios.get(`${httpBase}/wp-json`, { timeout: 10000 }).then(r => {
        base = httpBase
        api = `${base}/wp-json/wp/v2`
        return r
      })
    }
    throw err
  }).catch(() => null)

  const [postsRes, pagesRes, catsRes, tagsRes, siteRes] = await Promise.allSettled([
    axios.get(`${api}/posts?per_page=100&_embed=1&status=publish`, { timeout: 20000 }),
    axios.get(`${api}/pages?per_page=100&_embed=1&status=publish`, { timeout: 20000 }),
    axios.get(`${api}/categories?per_page=100`, { timeout: 20000 }),
    axios.get(`${api}/tags?per_page=100`, { timeout: 20000 }),
    testRes ? Promise.resolve(testRes) : axios.get(`${base}/wp-json`, { timeout: 10000 }),
  ])

  if (postsRes.status === 'rejected' && pagesRes.status === 'rejected') {
    const reason = (postsRes.reason as any)?.message || 'connection failed'
    throw new Error(
      `Cannot reach the WordPress REST API at ${base}/wp-json/wp/v2 (${reason}). ` +
      `Make sure: 1) the URL is correct, 2) the site is publicly accessible, ` +
      `3) the WordPress REST API is not disabled by a security plugin.`
    )
  }

  const siteInfo = siteRes.status === 'fulfilled' ? siteRes.value.data : {}

  const site: WPSite = {
    title: siteInfo.name || '',
    description: siteInfo.description || '',
    url: base,
    posts: [],
    pages: [],
    categories: [],
    tags: [],
  }

  if (catsRes.status === 'fulfilled') {
    site.categories = (catsRes.value.data as any[]).map((c: any) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description || '',
      count: c.count || 0,
    }))
  }

  if (tagsRes.status === 'fulfilled') {
    site.tags = (tagsRes.value.data as any[]).map((t: any) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
    }))
  }

  function mapPost(p: any, type: 'post' | 'page'): WPPost {
    const embedded = p._embedded || {}
    const terms: any[][] = embedded['wp:term'] || []
    const cats: string[] = []
    const tags: string[] = []
    for (const group of terms) {
      for (const t of group) {
        if (t.taxonomy === 'category') cats.push(t.name)
        if (t.taxonomy === 'post_tag') tags.push(t.name)
      }
    }
    const media = embedded['wp:featuredmedia']?.[0]
    return {
      id: p.id,
      title: p.title?.rendered || '',
      slug: p.slug,
      content: p.content?.rendered || '',
      excerpt: p.excerpt?.rendered || '',
      date: p.date || '',
      status: 'publish',
      type,
      categories: cats,
      tags,
      featuredImageUrl: media?.source_url,
      author: embedded.author?.[0]?.name || '',
    }
  }

  if (postsRes.status === 'fulfilled') {
    site.posts = (postsRes.value.data as any[]).map(p => mapPost(p, 'post'))
  }
  if (pagesRes.status === 'fulfilled') {
    site.pages = (pagesRes.value.data as any[]).map(p => mapPost(p, 'page'))
  }

  return site
}
