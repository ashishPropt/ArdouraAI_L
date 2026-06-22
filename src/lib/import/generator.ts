import { routedGenerate } from '@/lib/llm/router'
import type { WPSite } from './wordpress'

const SYSTEM = `You are an expert web developer converting WordPress sites to modern React + Node.js + PostgreSQL applications.
Generate complete, production-ready code. Return ONLY a valid JSON array — no markdown fences, no explanation text before or after.`

export async function generateFromWordPress(site: WPSite): Promise<Array<{ path: string; content: string; language: string }>> {
  const postSamples = site.posts.slice(0, 8).map(p =>
    `- "${p.title}" (slug: ${p.slug}, cats: ${p.categories.join(', ') || 'none'}, author: ${p.author})`
  ).join('\n')

  const pageSamples = site.pages.slice(0, 8).map(p =>
    `- "${p.title}" (slug: ${p.slug})`
  ).join('\n')

  const catList = site.categories.slice(0, 30).map(c =>
    `${c.name} (slug: ${c.slug}, count: ${c.count})`
  ).join(', ')

  const sampleContent = JSON.stringify(
    site.posts.slice(0, 5).map(p => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      excerpt: p.excerpt.replace(/<[^>]+>/g, '').slice(0, 300),
      content: p.content.slice(0, 1000),
      date: p.date,
      categories: p.categories,
      tags: p.tags,
      author: p.author,
      featuredImageUrl: p.featuredImageUrl || null,
    })),
    null,
    2
  )

  const prompt = `Convert this WordPress site to a React + Node.js + PostgreSQL application.

Site: "${site.title}"
Description: ${site.description}
URL: ${site.url}
Posts: ${site.posts.length} | Pages: ${site.pages.length} | Categories: ${site.categories.length} | Tags: ${site.tags.length}

Sample Posts:
${postSamples}${site.posts.length > 8 ? `\n... and ${site.posts.length - 8} more` : ''}

Pages:
${pageSamples || '(none)'}

Categories: ${catList || '(none)'}

Generate these exact files:

1. db/schema.sql — PostgreSQL tables: posts (id serial PK, wp_id int, title text, slug text UNIQUE, content text, excerpt text, author text, date timestamptz, featured_image text, status text), pages (same structure), categories (id serial PK, wp_id int, name text, slug text UNIQUE, description text), tags (same), post_categories (post_id, category_id), post_tags (post_id, tag_id)

2. db/seed.sql — INSERT categories and tags from the parsed data (all ${site.categories.length} categories)

3. scripts/import-content.js — Node.js script that reads data/content.json and bulk-inserts posts/pages/associations using pg. Run with: DATABASE_URL=... node scripts/import-content.js

4. data/content.json — Array of first 5 posts with structure matching the insert script:
${sampleContent}

5. server/db.js — pg Pool using DATABASE_URL env var

6. server/index.js — Express app (port process.env.PORT||3001), CORS, json(), mounts /api/posts /api/pages /api/categories routes, serves client/dist in production

7. server/routes/posts.js — GET /api/posts?page=1&limit=10&category=slug returns {posts,total,pages}; GET /api/posts/:slug returns single post with categories+tags

8. server/routes/pages.js — GET /api/pages returns all; GET /api/pages/:slug returns single

9. server/routes/categories.js — GET /api/categories returns all with post counts

10. package.json (root) — name: "${site.title.toLowerCase().replace(/\s+/g, '-')}-app", scripts: { "install:all": "npm i && cd client && npm i", "dev": "concurrently \\"npm run server\\" \\"npm run client\\"", "server": "node server/index.js", "client": "cd client && npm run dev", "build": "cd client && npm run build", "start": "NODE_ENV=production node server/index.js" }, dependencies: express cors pg dotenv concurrently

11. .env.example — DATABASE_URL=postgresql://user:password@localhost:5432/dbname\nPORT=3001

12. client/package.json — name: client, scripts dev/build/preview using vite, deps: react react-dom react-router-dom axios, devDeps: @vitejs/plugin-react vite tailwindcss @tailwindcss/typography postcss autoprefixer

13. client/vite.config.js — proxy /api → http://localhost:3001

14. client/tailwind.config.js — content: ['./index.html','./src/**/*.{js,jsx}'], plugins: [@tailwindcss/typography]

15. client/postcss.config.js — tailwindcss, autoprefixer

16. client/index.html — standard Vite HTML shell, title "${site.title}"

17. client/src/main.jsx — ReactDOM.createRoot with BrowserRouter wrapping App

18. client/src/App.jsx — react-router-dom Routes: / → Home, /post/:slug → Post, /page/:slug → Page, /category/:slug → Category, wraps in Header+Footer layout div

19. client/src/api.js — axios instance pointing to /api, exports getPosts(page,category), getPost(slug), getPages(), getPage(slug), getCategories()

20. client/src/components/Header.jsx — site title "${site.title}" as home link, nav links for top 6 categories, responsive hamburger menu

21. client/src/components/Footer.jsx — site description, copyright ${new Date().getFullYear()}, ${site.title}

22. client/src/components/PostCard.jsx — card with featured image (if present), title linked to /post/:slug, excerpt (strip HTML tags), date formatted, category badges linked to /category/:slug, author

23. client/src/components/Pagination.jsx — prev/next buttons + page numbers, takes {page, totalPages, onPageChange}

24. client/src/pages/Home.jsx — fetches getPosts on mount and page change, grid of PostCard, Pagination, loading skeleton

25. client/src/pages/Post.jsx — fetches getPost(slug), renders title, meta (date/author/cats), full content in prose div with dangerouslySetInnerHTML, featured image header

26. client/src/pages/Page.jsx — fetches getPage(slug), renders title + content

27. client/src/pages/Category.jsx — fetches getPosts with category filter from URL param, shows category title + PostCard grid + Pagination

28. client/src/index.css — @tailwind base/components/utilities, body font-sans bg-gray-50 text-gray-900, .prose img max-w-full rounded, .prose a text-blue-600

29. README.md — step by step: clone, npm run install:all, create postgres DB, psql < db/schema.sql, psql < db/seed.sql, cp .env.example .env (edit), DATABASE_URL=... node scripts/import-content.js, npm run dev → localhost:3001 API + localhost:5173 UI

Return ONLY a JSON array of objects with keys: path (string), content (string), language (string). No markdown, no preamble.`

  const { text } = await routedGenerate(
    [{ role: 'user', content: prompt }],
    SYSTEM,
    'high'
  )

  // Extract JSON array from response
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) throw new Error('LLM did not return a valid JSON array')

  return JSON.parse(match[0]) as Array<{ path: string; content: string; language: string }>
}
