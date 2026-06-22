import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'
import { executeHeyGen } from '@/lib/mcp/tools/heygen'
import { decryptObject } from '@/lib/vault/encrypt'

type Params = { params: { id: string } }

// Poll HeyGen for render status
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const video = await prisma.marketingVideo.findFirst({
    where: { id: params.id },
    include: { project: true },
  })
  if (!video || video.project.userId !== session.user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Poll HeyGen if still rendering and we have a videoId
  if (video.status === 'RENDERING' && video.heygenVideoId) {
    const heygenIntegration = await prisma.integration.findFirst({
      where: { userId: session.user.id, type: 'HEYGEN' as any },
    })
    if (heygenIntegration) {
      const config = decryptObject<{ apiKey: string }>(heygenIntegration.config)
      const result = await executeHeyGen('check_video_status', { videoId: video.heygenVideoId }, config)
      if (result.success && result.data?.status !== 'RENDERING') {
        const updated = await prisma.marketingVideo.update({
          where: { id: video.id },
          data: {
            status: result.data.status,
            videoUrl: result.data.videoUrl,
            thumbnailUrl: result.data.thumbnailUrl,
            durationSecs: result.data.durationSecs,
          },
        })
        return NextResponse.json(updated)
      }
    }
  }

  return NextResponse.json(video)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const video = await prisma.marketingVideo.findFirst({ where: { id: params.id }, include: { project: true } })
  if (!video || video.project.userId !== session.user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.marketingVideo.delete({ where: { id: params.id } })
  return NextResponse.json({ deleted: true })
}
