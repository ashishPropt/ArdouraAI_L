import { XMLParser } from 'fast-xml-parser'
import axios from 'axios'

export interface WPPost {
  id: number
  title: string
  slug: string
  content: string        // full HTML
  excerpt: string
  date: string
  status: string
  type: 'post' | 'page' | 'custom'
  postType: string       // exact WP post type
  categories: string[]
  tags: string[]
  featuredImageUrl?: string
  author: string
  parentId: number       // for page hierarchy
  menuOrder: number
  template: string       // page template hint
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

export interface WPMenuItem {
  id: number
  title: string
  url: string
  slug: string
  objectType: string    // 'page' | 'post' | 'category' | 'custom'
  objectId: number
  parentId: number
  order: number
  target: string
  children: WPMenuItem[]
}

export interface WPMenu {
  id: number
  name: string
  slug: string
  items: WPMenuItem[]
}

export interface WPMedia {
  id: number
  title: string
  url: string
  alt: string
  mimeType: string
  width?: number
  height?: number
}

export interface WPSite {
  title: string
  description: string
  url: string
  language: string
  frontPageId: number   // 0 = blog listing
  blogPageId: number
  posts: WPPost[]
  pages: WPPost[]
  customPostTypes: WPPost[]
  categories: WPCategory[]
  tags: WPTag[]
  menus: WPMenu[]
  media: WPMedia[]
  // scraped extras
  faviconUrl?: string
  primaryColor?: string
  themeStyleUrl?: string
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function cdata(val: any): string {
  if (!val) return ''
  if (typeof val === 'object' && val.__cdata !== undefined) return String(val.__cdata)
  return String(val)
}

function getMeta(metas: any[], key: string): string {
  if (!Array.isArray(metas)) return ''
  const m = metas.find((m: any) => cdata(m['wp:meta_key']) === key)
  return m ? cdata(m['wp:meta_value']) : ''
}

function buildMenuTree(flat: WPMenuItem[]): WPMenuItem[] {
  const map = new Map<number, WPMenuItem>()
  flat.forEach(i => map.set(i.id, { ...i, children: [] }))
  const roots: WPMenuItem[] = []
  map.forEach(item => {
    if (item.parentId === 0) roots.push(item)
    else map.get(item.parentId)?.children.push(item)
  })
  return roots.sort((a, b) => a.order - b.order)
}

// ─── WXR parser ───────────────────────────────────────────────────────────────

export function parseWXR(xmlContent: string): WPSite {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    cdataPropName: '__cdata',
    allowBooleanAttributes: true,
    parseTagValue: false,
    isArray: (_name, jpath) => jpath.endsWith('item') || jpath.endsWith('wp:postmeta') || jpath.endsWith('category'),
  })

  const result = parser.parse(xmlContent)
  const channel = result?.rss?.channel
  if (!channel) throw new Error('Invalid WordPress export file — no <channel> found')

  const site: WPSite = {
    title: cdata(channel.title) || '',
    description: cdata(channel.description) || '',
    url: cdata(channel['wp:base_site_url']) || cdata(channel.link) || '',
    language: cdata(channel.language) || 'en',
    frontPageId: 0,
    blogPageId: 0,
    posts: [],
    pages: [],
    customPostTypes: [],
    categories: [],
    tags: [],
    menus: [],
    media: [],
  }

  // categories
  const rawCats = channel['wp:category']
    ? Array.isArray(channel['wp:category']) ? channel['wp:category'] : [channel['wp:category']] : []
  site.categories = rawCats.map((c: any) => ({
    id: Number(cdata(c['wp:term_id'])) || 0,
    name: cdata(c['wp:cat_name']),
    slug: cdata(c['wp:category_nicename']),
    description: cdata(c['wp:category_description']),
    count: 0,
  }))

  // tags
  const rawTags = channel['wp:tag']
    ? Array.isArray(channel['wp:tag']) ? channel['wp:tag'] : [channel['wp:tag']] : []
  site.tags = rawTags.map((t: any) => ({
    id: Number(cdata(t['wp:term_id'])) || 0,
    name: cdata(t['wp:tag_name']),
    slug: cdata(t['wp:tag_slug']),
  }))

  const items: any[] = channel.item || []

  // Nav menu items (collect by menu term slug)
  const menuItemsByMenu = new Map<string, WPMenuItem[]>()

  for (const item of items) {
    const postType = cdata(item['wp:post_type'])
    const status = cdata(item['wp:status'])
    const metas: any[] = Array.isArray(item['wp:postmeta']) ? item['wp:postmeta']
      : item['wp:postmeta'] ? [item['wp:postmeta']] : []

    // ── navigation menu items ──
    if (postType === 'nav_menu_item') {
      const menuCats = Array.isArray(item.category) ? item.category
        : item.category ? [item.category] : []
      const menuTermSlug = menuCats
        .filter((c: any) => c['@_domain'] === 'nav_menu')
        .map((c: any) => (c['@_nicename'] || ''))
        .find(Boolean) || 'main'

      const menuItem: WPMenuItem = {
        id: Number(cdata(item['wp:post_id'])) || 0,
        title: cdata(item.title),
        url: getMeta(metas, '_menu_item_url'),
        slug: '',
        objectType: getMeta(metas, '_menu_item_object'),
        objectId: Number(getMeta(metas, '_menu_item_object_id')) || 0,
        parentId: Number(getMeta(metas, '_menu_item_menu_item_parent')) || 0,
        order: Number(cdata(item['wp:menu_order'])) || 0,
        target: getMeta(metas, '_menu_item_target'),
        children: [],
      }
      if (!menuItemsByMenu.has(menuTermSlug)) menuItemsByMenu.set(menuTermSlug, [])
      menuItemsByMenu.get(menuTermSlug)!.push(menuItem)
      continue
    }

    // ── attachment (media) ──
    if (postType === 'attachment') {
      const attachmentUrl = cdata(item['wp:attachment_url'])
      if (attachmentUrl) {
        site.media.push({
          id: Number(cdata(item['wp:post_id'])) || 0,
          title: cdata(item.title),
          url: attachmentUrl,
          alt: getMeta(metas, '_wp_attachment_image_alt'),
          mimeType: cdata(item['wp:post_mime_type']),
        })
      }
      continue
    }

    if (!['post', 'page', 'product', 'portfolio', 'service', 'team', 'testimonial'].includes(postType)) continue
    if (!['publish', 'inherit'].includes(status)) continue

    const itemCats = Array.isArray(item.category) ? item.category
      : item.category ? [item.category] : []
    const cats: string[] = []
    const tags: string[] = []
    for (const c of itemCats) {
      const domain = c['@_domain'] || ''
      const text = cdata(c) || ''
      if (domain === 'category') cats.push(text)
      else if (domain === 'post_tag') tags.push(text)
    }

    // resolve featured image from attachment id
    const thumbnailId = getMeta(metas, '_thumbnail_id')
    const featuredImageUrl = thumbnailId
      ? site.media.find(m => m.id === Number(thumbnailId))?.url
      : undefined

    const post: WPPost = {
      id: Number(cdata(item['wp:post_id'])) || 0,
      title: cdata(item.title),
      slug: cdata(item['wp:post_name']),
      content: cdata(item['content:encoded']),
      excerpt: cdata(item['excerpt:encoded']),
      date: cdata(item['wp:post_date']) || cdata(item.pubDate),
      status,
      type: postType === 'post' ? 'post' : postType === 'page' ? 'page' : 'custom',
      postType,
      categories: cats,
      tags,
      featuredImageUrl,
      author: cdata(item['dc:creator']),
      parentId: Number(cdata(item['wp:post_parent'])) || 0,
      menuOrder: Number(cdata(item['wp:menu_order'])) || 0,
      template: getMeta(metas, '_wp_page_template'),
    }

    if (postType === 'post') site.posts.push(post)
    else if (postType === 'page') site.pages.push(post)
    else site.customPostTypes.push(post)
  }

  // build menu objects
  menuItemsByMenu.forEach((flatItems, slug) => {
    site.menus.push({
      id: site.menus.length + 1,
      name: slug,
      slug,
      items: buildMenuTree(flatItems),
    })
  })

  return site
}

// ─── WordPress REST API fetcher ───────────────────────────────────────────────

async function tryGet(url: string, timeout = 15000) {
  return axios.get(url, { timeout }).catch(() => null)
}

export async function fetchFromWPAPI(siteUrl: string): Promise<WPSite> {
  let base = siteUrl.trim().replace(/\/$/, '').replace(/\/wp-json(\/.*)?$/, '')
  if (!/^https?:\/\//i.test(base)) base = `https://${base}`

  // Probe — fall back to http if https fails
  const probe = await tryGet(`${base}/wp-json`, 10000)
  if (!probe) {
    if (base.startsWith('https://')) {
      const httpBase = base.replace('https://', 'http://')
      const httpProbe = await tryGet(`${httpBase}/wp-json`, 10000)
      if (httpProbe) base = httpBase
      else throw new Error(
        `Cannot reach the WordPress REST API at ${base}/wp-json. ` +
        `Check the URL is correct and the site is publicly accessible.`
      )
    }
  }

  const api = `${base}/wp-json/wp/v2`
  const siteInfo = probe?.data || {}

  // Fetch everything in parallel
  const [
    postsRes, pagesRes, catsRes, tagsRes,
    menuItemsRes, mediaRes, settingsRes, typesRes,
  ] = await Promise.allSettled([
    axios.get(`${api}/posts?per_page=100&_embed=1&status=publish`, { timeout: 20000 }),
    axios.get(`${api}/pages?per_page=100&_embed=1&status=publish`, { timeout: 20000 }),
    axios.get(`${api}/categories?per_page=100`, { timeout: 15000 }),
    axios.get(`${api}/tags?per_page=100`, { timeout: 15000 }),
    axios.get(`${api}/menu-items?per_page=100&_embed=1`, { timeout: 15000 }),   // WP 5.9+
    axios.get(`${api}/media?per_page=50&media_type=image`, { timeout: 20000 }),
    tryGet(`${api}/settings`, 10000),   // usually needs auth; best-effort
    axios.get(`${api}/types`, { timeout: 10000 }),
  ])

  if (postsRes.status === 'rejected' && pagesRes.status === 'rejected') {
    const reason = (postsRes.reason as any)?.message || 'connection failed'
    throw new Error(
      `Cannot reach the WordPress REST API at ${base}/wp-json/wp/v2 (${reason}). ` +
      `Ensure the URL is correct, the site is publicly accessible, and the REST API is not disabled.`
    )
  }

  // Read settings for front page / blog page IDs
  let frontPageId = 0
  let blogPageId = 0
  if (settingsRes && (settingsRes as any).status === 'fulfilled' && (settingsRes as any).value) {
    const s = (settingsRes as any).value.data || {}
    frontPageId = s.page_on_front || 0
    blogPageId = s.page_for_posts || 0
  }

  // Detect additional registered public post types
  const extraTypes: string[] = []
  if (typesRes.status === 'fulfilled') {
    const types = typesRes.value.data as Record<string, any>
    for (const [slug, t] of Object.entries(types)) {
      if (!['post', 'page', 'attachment', 'nav_menu_item', 'wp_block', 'wp_template', 'wp_template_part', 'wp_navigation'].includes(slug)
        && t.rest_base) {
        extraTypes.push(t.rest_base)
      }
    }
  }

  // Fetch custom post types
  const customResults = await Promise.allSettled(
    extraTypes.slice(0, 5).map(restBase =>
      axios.get(`${api}/${restBase}?per_page=50&_embed=1&status=publish`, { timeout: 15000 })
    )
  )

  function mapPost(p: any, postType: string): WPPost {
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
      type: postType === 'post' ? 'post' : postType === 'page' ? 'page' : 'custom',
      postType,
      categories: cats,
      tags,
      featuredImageUrl: media?.source_url,
      author: embedded.author?.[0]?.name || '',
      parentId: p.parent || 0,
      menuOrder: p.menu_order || 0,
      template: p.template || '',
    }
  }

  const site: WPSite = {
    title: siteInfo.name || '',
    description: siteInfo.description || '',
    url: base,
    language: siteInfo.language || 'en-US',
    frontPageId,
    blogPageId,
    posts: postsRes.status === 'fulfilled' ? (postsRes.value.data as any[]).map(p => mapPost(p, 'post')) : [],
    pages: pagesRes.status === 'fulfilled' ? (pagesRes.value.data as any[]).map(p => mapPost(p, 'page')) : [],
    customPostTypes: [],
    categories: catsRes.status === 'fulfilled' ? (catsRes.value.data as any[]).map((c: any) => ({
      id: c.id, name: c.name, slug: c.slug, description: c.description || '', count: c.count || 0,
    })) : [],
    tags: tagsRes.status === 'fulfilled' ? (tagsRes.value.data as any[]).map((t: any) => ({
      id: t.id, name: t.name, slug: t.slug,
    })) : [],
    menus: [],
    media: mediaRes.status === 'fulfilled' ? (mediaRes.value.data as any[]).map((m: any) => ({
      id: m.id,
      title: m.title?.rendered || '',
      url: m.source_url || '',
      alt: m.alt_text || '',
      mimeType: m.mime_type || '',
      width: m.media_details?.width,
      height: m.media_details?.height,
    })) : [],
  }

  // Collect custom post type content
  extraTypes.forEach((restBase, i) => {
    const res = customResults[i]
    if (res.status === 'fulfilled') {
      const typeName = restBase.replace(/-/g, '_')
      site.customPostTypes.push(...(res.value.data as any[]).map((p: any) => mapPost(p, typeName)))
    }
  })

  // Build navigation menus from menu-items (WP 5.9+)
  if (menuItemsRes.status === 'fulfilled') {
    const rawItems: any[] = menuItemsRes.value.data
    const byMenu = new Map<string, WPMenuItem[]>()

    for (const item of rawItems) {
      const menuId = item.menus || 0
      const key = String(menuId)
      const menuItem: WPMenuItem = {
        id: item.id,
        title: item.title?.rendered || '',
        url: item.url || '',
        slug: item.slug || '',
        objectType: item.object || 'custom',
        objectId: item.object_id || 0,
        parentId: item.parent || 0,
        order: item.menu_order || 0,
        target: item.target || '',
        children: [],
      }
      if (!byMenu.has(key)) byMenu.set(key, [])
      byMenu.get(key)!.push(menuItem)
    }

    byMenu.forEach((items, key) => {
      site.menus.push({
        id: Number(key),
        name: `Menu ${key}`,
        slug: `menu-${key}`,
        items: buildMenuTree(items),
      })
    })
  }

  // Fallback: build a nav from top-level pages if no menu found
  if (site.menus.length === 0 && site.pages.length > 0) {
    const navPages = site.pages
      .filter(p => p.parentId === 0)
      .sort((a, b) => a.menuOrder - b.menuOrder)
    site.menus.push({
      id: 0,
      name: 'Primary',
      slug: 'primary',
      items: navPages.map(p => ({
        id: p.id, title: p.title, url: `/${p.slug}`, slug: p.slug,
        objectType: 'page', objectId: p.id, parentId: 0, order: p.menuOrder,
        target: '', children: [],
      })),
    })
  }

  return site
}
