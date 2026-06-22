import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'
import { generateVideoScript } from '@/lib/marketing/generator'
import { executeHeyGen } from '@/lib/mcp/tools/heygen'
import { decryptObject } from '@/lib/vault/encrypt'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const projectId = new URL(req.url).searchParams.get('projectId')
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 })

  const project = await prisma.project.findFirst({ where: { id: projectId, userId: session.user.id } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const videos = await prisma.marketingVideo.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' } })
  return NextResponse.json(videos)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectId, type = 'DEMO', avatarId, voiceId } = await req.json()

  const project = await prisma.project.findFirst({ where: { id: projectId, userId: session.user.id } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Generate script with LLM
  const script = await generateVideoScript(
    { name: project.name, description: project.description, deployedUrl: project.deployedUrl },
    type as 'DEMO' | 'FEATURE' | 'LAUNCH'
  )

  // Create DB record
  const video = await prisma.marketingVideo.create({
    data: { projectId, type, title: `${project.name} — ${type} Video`, script, status: 'RENDERING' },
  })

  // Kick off HeyGen render if API key configured
  const heygenIntegration = await prisma.integration.findFirst({
    where: { userId: session.user.id, type: 'HEYGEN' as any },
  })

  if (heygenIntegration) {
    const config = decryptObject<{ apiKey: string }>(heygenIntegration.config)
    try {
      const result = await executeHeyGen('generate_video', { script, avatarId, voiceId, title: video.title }, config)
      if (result.success && result.data?.videoId) {
        await prisma.marketingVideo.update({
          where: { id: video.id },
          data: { heygenVideoId: result.data.videoId },
        })
      }
    } catch (err) {
      console.error('HeyGen render failed:', err)
    }
  }

  return NextResponse.json(video, { status: 201 })
}
