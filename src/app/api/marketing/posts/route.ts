import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'
import { generateSocialPosts } from '@/lib/marketing/generator'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId')
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 })

  const project = await prisma.project.findFirst({ where: { id: projectId, userId: session.user.id } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const posts = await prisma.marketingPost.findMany({
    where: { projectId },
    orderBy: { scheduledAt: 'asc' },
  })
  return NextResponse.json(posts)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { projectId, action } = body

  const project = await prisma.project.findFirst({ where: { id: projectId, userId: session.user.id } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Auto-generate posts for all platforms
  if (action === 'generate') {
    const generated = await generateSocialPosts({
      name: project.name,
      description: project.description,
      deployedUrl: project.deployedUrl,
    })

    const platformMap: Record<string, string> = {
      twitter: 'TWITTER',
      linkedin: 'LINKEDIN',
      reddit: 'REDDIT',
      producthunt_tagline: 'PRODUCTHUNT',
    }

    const posts = await Promise.all(
      Object.entries(platformMap).map(([key, platform]) =>
        generated[key]
          ? prisma.marketingPost.create({
              data: {
                projectId,
                platform: platform as any,
                content: Array.isArray(generated[key])
                  ? (generated[key] as string[]).join('\n\n---\n\n')
                  : generated[key] as string,
                status: 'DRAFT',
              },
            })
          : null
      )
    )

    return NextResponse.json({ generated: posts.filter(Boolean) })
  }

  // Create single post manually
  const { platform, content, scheduledAt, imageUrl, calendarId } = body
  const post = await prisma.marketingPost.create({
    data: {
      projectId,
      platform,
      content,
      imageUrl,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      calendarId,
      status: scheduledAt ? 'SCHEDULED' : 'DRAFT',
    },
  })
  return NextResponse.json(post, { status: 201 })
}
