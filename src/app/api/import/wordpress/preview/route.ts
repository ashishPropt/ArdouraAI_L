import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { parseWXR, fetchFromWPAPI } from '@/lib/import/wordpress'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const contentType = req.headers.get('content-type') || ''
    let site

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData()
      const file = form.get('file') as File | null
      if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
      const xml = await file.text()
      site = parseWXR(xml)
    } else {
      const body = await req.json()
      if (!body.url) return NextResponse.json({ error: 'No URL provided' }, { status: 400 })
      site = await fetchFromWPAPI(body.url)
    }

    return NextResponse.json({
      title: site.title,
      description: site.description,
      url: site.url,
      counts: {
        posts: site.posts.length,
        pages: site.pages.length,
        categories: site.categories.length,
        tags: site.tags.length,
      },
      samplePosts: site.posts.slice(0, 5).map(p => ({
        title: p.title,
        slug: p.slug,
        date: p.date,
        categories: p.categories,
        author: p.author,
      })),
      samplePages: site.pages.slice(0, 5).map(p => ({
        title: p.title,
        slug: p.slug,
      })),
      categories: site.categories.slice(0, 20).map(c => ({
        name: c.name,
        slug: c.slug,
        count: c.count,
      })),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Preview failed' }, { status: 500 })
  }
}
