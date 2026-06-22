import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'
import { executeTwitter, executeLinkedIn, executeReddit } from '@/lib/mcp/tools/social'
import { decryptObject } from '@/lib/vault/encrypt'

type Params = { params: { id: string } }

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const post = await prisma.marketingPost.findFirst({
    where: { id: params.id },
    include: { project: true },
  })
  if (!post || post.project.userId !== session.user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()

  // Publish immediately
  if (body.action === 'publish') {
    const account = await prisma.socialAccount.findFirst({
      where: { userId: session.user.id, platform: post.platform },
    })
    if (!account) return NextResponse.json({ error: 'No social account connected for this platform' }, { status: 400 })

    const config = decryptObject<Record<string, string>>(account.accessToken)
    let result: { success: boolean; data?: any; error?: string }

    if (post.platform === 'TWITTER') {
      const isThread = post.content.includes('\n\n---\n\n')
      if (isThread) {
        result = await executeTwitter('post_thread', { tweets: post.content.split('\n\n---\n\n') }, config as any)
      } else {
        result = await executeTwitter('post_tweet', { text: post.content }, config as any)
      }
    } else if (post.platform === 'LINKEDIN') {
      result = await executeLinkedIn('post_update', { text: post.content }, config as any)
    } else if (post.platform === 'REDDIT') {
      result = await executeReddit('submit_post', {
        subreddit: body.subreddit ?? 'SaaS',
        title: body.title ?? post.project.name,
        text: post.content,
      }, config as any)
    } else {
      return NextResponse.json({ error: `Direct publish not yet supported for ${post.platform}` }, { status: 400 })
    }

    if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 })

    const updated = await prisma.marketingPost.update({
      where: { id: params.id },
      data: { status: 'PUBLISHED', publishedAt: new Date(), externalId: result.data?.tweetId ?? result.data?.postId ?? result.data?.id },
    })
    return NextResponse.json(updated)
  }

  // Update fields
  const updated = await prisma.marketingPost.update({
    where: { id: params.id },
    data: {
      ...(body.content !== undefined && { content: body.content }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.scheduledAt !== undefined && { scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null }),
      ...(body.imageUrl !== undefined && { imageUrl: body.imageUrl }),
    },
  })
  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const post = await prisma.marketingPost.findFirst({ where: { id: params.id }, include: { project: true } })
  if (!post || post.project.userId !== session.user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.marketingPost.delete({ where: { id: params.id } })
  return NextResponse.json({ deleted: true })
}
