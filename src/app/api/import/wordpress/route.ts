import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'
import { parseWXR, fetchFromWPAPI } from '@/lib/import/wordpress'
import { generateFromWordPress } from '@/lib/import/generator'

export const maxDuration = 120

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

    // Create project record
    const project = await prisma.project.create({
      data: {
        name: `${site.title} (WP Import)`,
        description: `Converted from WordPress: ${site.url || 'uploaded file'}. ${site.posts.length} posts, ${site.pages.length} pages, ${site.categories.length} categories.`,
        userId: session.user.id,
      },
    })

    // Save the user intent as a message
    await prisma.message.create({
      data: {
        projectId: project.id,
        role: 'USER',
        content: `Convert my WordPress site "${site.title}" to a React + Node.js + PostgreSQL app. It has ${site.posts.length} posts, ${site.pages.length} pages, and ${site.categories.length} categories.`,
      },
    })

    // Generate the full application code
    const files = await generateFromWordPress(site)

    // Persist generated files
    if (files.length > 0) {
      await prisma.projectFile.createMany({
        data: files.map(f => ({
          projectId: project.id,
          path: f.path,
          content: f.content,
          language: f.language,
        })),
      })
    }

    // Save assistant summary
    await prisma.message.create({
      data: {
        projectId: project.id,
        role: 'ASSISTANT',
        content: `✅ **WordPress import complete!**\n\n"${site.title}" has been converted to a modern React + Node.js + PostgreSQL application.\n\n**What was generated (${files.length} files):**\n- \`db/schema.sql\` — PostgreSQL schema\n- \`db/seed.sql\` — categories & tags seed data\n- \`scripts/import-content.js\` — content import script\n- \`data/content.json\` — sample post data\n- \`server/\` — Express API (posts, pages, categories)\n- \`client/\` — React app with routing & Tailwind\n\n**To run locally:**\n\`\`\`bash\nnpm run install:all\ncp .env.example .env   # add your DATABASE_URL\npsql < db/schema.sql\npsql < db/seed.sql\nDATABASE_URL=... node scripts/import-content.js\nnpm run dev\n\`\`\`\n\nAsk me to make changes — add a search bar, change the layout, add comments, etc.`,
      },
    })

    return NextResponse.json({
      projectId: project.id,
      filesGenerated: files.length,
      summary: {
        title: site.title,
        posts: site.posts.length,
        pages: site.pages.length,
        categories: site.categories.length,
      },
    })
  } catch (err: any) {
    console.error('WordPress import error:', err)
    return NextResponse.json({ error: err.message || 'Import failed' }, { status: 500 })
  }
}
