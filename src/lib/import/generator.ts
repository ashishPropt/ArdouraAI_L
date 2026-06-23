import { routedGenerate } from '@/lib/llm/router'
import type { WPSite, WPMenuItem } from './wordpress'

const SYSTEM = `You are an expert web developer converting WordPress sites to modern React + Node.js + PostgreSQL applications.
You preserve ALL content — every page, post, navigation item, and custom post type.
Return ONLY a valid JSON array of file objects — no markdown fences, no explanation.`

function flattenMenuItems(items: WPMenuItem[], depth = 0): string {
  return items.map(item => {
    const indent = '  '.repeat(depth)
    const children = item.children.length > 0 ? '\n' + flattenMenuItems(item.children, depth + 1) : ''
    return `${indent}- "${item.title}" → ${item.url || `/${item.slug}`}${item.target === '_blank' ? ' [external]' : ''}${children}`
  }).join('\n')
}

export async function generateFromWordPress(
  site: WPSite
): Promise<Array<{ path: string; content: string; language: string }>> {

  // Build navigation description
  const navDesc = site.menus.length > 0
    ? site.menus.map(m => `Menu "${m.name}":\n${flattenMenuItems(m.items)}`).join('\n\n')
    : 'No menus found — use top-level pages as nav'

  // Describe every page with its full content (truncated per page)
  const pageDesc = site.pages.map(p => {
    const content = p.content.slice(0, 800).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    return `  Page: "${p.title}" slug=/${p.slug} parentId=${p.parentId}${p.featuredImageUrl ? ` image=${p.featuredImageUrl}` : ''}\n    Content preview: ${content || '(empty)'}...`
  }).join('\n')

  // Describe custom post types
  const cptTypeSet = new Set(site.customPostTypes.map(p => p.postType))
  const uniqueCptTypes: string[] = []
  cptTypeSet.forEach(t => uniqueCptTypes.push(t))
  const cptDesc = site.customPostTypes.length > 0
    ? uniqueCptTypes.map(type => {
        const items = site.customPostTypes.filter(p => p.postType === type)
        return `  Post type "${type}": ${items.length} items — ${items.slice(0, 5).map(i => `"${i.title}"`).join(', ')}${items.length > 5 ? '...' : ''}`
      }).join('\n')
    : '  (none)'

  // Sample posts for data seeding
  const postDataSample = JSON.stringify(
    site.posts.slice(0, 10).map(p => ({
      id: p.id, title: p.title, slug: p.slug,
      excerpt: p.excerpt.replace(/<[^>]+>/g, '').slice(0, 200),
      content: p.content.slice(0, 500),
      date: p.date, categories: p.categories, tags: p.tags,
      author: p.author, featuredImageUrl: p.featuredImageUrl || null,
    })), null, 2)

  // All pages data for seeding
  const pageDataSample = JSON.stringify(
    site.pages.map(p => ({
      id: p.id, title: p.title, slug: p.slug,
      content: p.content.slice(0, 1000),
      parentId: p.parentId, menuOrder: p.menuOrder,
      featuredImageUrl: p.featuredImageUrl || null,
    })), null, 2)

  const prompt = `Convert this WordPress site to a complete React + Express + PostgreSQL application.
Preserve EVERY page with its real content. This is a full website, not just a blog.

## Site Info
- Title: "${site.title}"
- Description: "${site.description}"
- URL: ${site.url}
- Homepage type: ${site.frontPageId > 0 ? `Static page (id=${site.frontPageId})` : 'Blog listing'}
- Language: ${site.language}

## Stats
- ${site.posts.length} blog posts | ${site.pages.length} pages | ${site.categories.length} categories | ${site.customPostTypes.length} custom post items

## Navigation Menus
${navDesc}

## All Pages (these all need React routes)
${pageDesc}

## Custom Post Types
${cptDesc}

## Categories
${site.categories.map(c => `${c.name} (${c.count} posts)`).join(', ')}

Generate these files:

**Database layer:**
1. db/schema.sql — tables: posts (id,wp_id,slug UNIQUE,title,content,excerpt,author,date,featured_image,post_type,parent_id,menu_order), pages (same), categories, tags, post_categories, post_tags, custom_items (id,wp_id,slug,title,content,post_type,featured_image)

2. db/seed.sql — INSERT all ${site.categories.length} categories and all ${site.tags.length} tags

3. data/pages.json — ALL ${site.pages.length} pages with full content:
${pageDataSample}

4. data/posts.json — first 10 of ${site.posts.length} posts:
${postDataSample}

5. scripts/import-content.js — reads data/pages.json + data/posts.json, bulk inserts into PostgreSQL. Run: DATABASE_URL=... node scripts/import-content.js

**Server:**
6. server/db.js — pg Pool from DATABASE_URL
7. server/index.js — Express, CORS, JSON, mounts all routes, serves client/dist in production
8. server/routes/pages.js — GET /api/pages (all), GET /api/pages/:slug (single by slug)
9. server/routes/posts.js — GET /api/posts?page&limit&category, GET /api/posts/:slug
10. server/routes/categories.js — GET /api/categories with counts
11. server/routes/navigation.js — GET /api/navigation returns the menu structure as JSON (hard-code the menu from the data above)

**Client:**
12. client/package.json — React + Vite + react-router-dom + axios + @tailwindcss/typography
13. client/vite.config.js — proxy /api → http://localhost:3001
14. client/tailwind.config.js — content globs, @tailwindcss/typography plugin
15. client/postcss.config.js
16. client/index.html — title "${site.title}"
17. client/src/main.jsx — ReactDOM + BrowserRouter + App
18. client/src/api.js — axios instance, exports: getPage(slug), getPages(), getPosts(page,cat), getPost(slug), getCategories(), getNavigation()

19. client/src/components/Header.jsx — Site title "${site.title}", navigation using getNavigation() API result. Render the EXACT menu structure from the data: ${site.menus[0]?.items.slice(0, 8).map(i => `"${i.title}"`).join(', ') || 'top-level pages'}. Support dropdown for items with children. Mobile hamburger menu.

20. client/src/components/Footer.jsx — Site title, description "${site.description}", copyright ${new Date().getFullYear()}. Include footer nav links from last menu or page list.

21. client/src/App.jsx — react-router-dom Routes with ALL the following routes:
    - / → Home
${site.pages.map(p => `    - /${p.slug} → Page`).join('\n')}
    - /blog → BlogListing (if there are posts)
    - /blog/:slug → SinglePost
    - /category/:slug → CategoryPage
    Also wrap all routes in Header + Footer layout.

22. client/src/pages/Home.jsx — ${site.frontPageId > 0
    ? `Static homepage. Render the content of the page with id=${site.frontPageId} fetched from /api/pages/${site.pages.find(p => p.id === site.frontPageId)?.slug || 'home'}. Display featured image if present. Render HTML content in a prose div.`
    : `Blog-style homepage showing latest posts grid (3 cols), categories sidebar, hero with site title and description.`}

${site.pages.map(p => `23+. client/src/pages/${p.slug.replace(/-/g, '_').replace(/[^a-zA-Z0-9_]/g, '')}_page.jsx — Fetch /api/pages/${p.slug}, render: page title as h1, featured image if present, full HTML content in <div className="prose max-w-none" dangerouslySetInnerHTML={{__html: page.content}} />. Show loading skeleton while fetching.`).join('\n')}

Also:
- client/src/pages/BlogListing.jsx — paginated blog grid with PostCard, category filter
- client/src/pages/SinglePost.jsx — full post: title, date, author, categories, featured image, HTML content in prose div
- client/src/pages/CategoryPage.jsx — filtered posts by category slug from URL
- client/src/components/PostCard.jsx — card: featured image, title linked to /blog/:slug, excerpt (strip HTML), date, category tags
- client/src/components/Pagination.jsx — prev/next + page numbers
- client/src/index.css — @tailwind directives, body font styling, .prose img { max-width:100%; border-radius:0.5rem; } .prose a { color: #3b82f6; }

**Root:**
- package.json (root) — scripts: install:all, dev (concurrently server + client), build, start
- .env.example
- README.md — full setup: npm run install:all, create DB, schema.sql, seed.sql, import-content.js, npm run dev

IMPORTANT RULES:
1. Every page listed above MUST have its own React component with a real route
2. Navigation must reflect the ACTUAL menu structure from the WordPress data, not a generic placeholder
3. Page content is fetched from the API and rendered via dangerouslySetInnerHTML — this preserves all HTML formatting, images, embeds from the original WP content
4. Images from the original site are referenced by their original URLs (they remain hosted on the WP server)
5. The design should be clean, modern Tailwind — not a WP theme copy, but a professional modern conversion

Return ONLY a JSON array: [{"path":"...","content":"...","language":"js|jsx|sql|json|css|md"}]`

  const { text } = await routedGenerate(
    [{ role: 'user', content: prompt }],
    SYSTEM,
    'high'
  )

  const match = text.match(/\[[\s\S]*\]/)
  if (!match) throw new Error('LLM did not return a valid JSON array')

  return JSON.parse(match[0]) as Array<{ path: string; content: string; language: string }>
}
