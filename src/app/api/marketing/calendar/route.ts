import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'
import { generateContentCalendar } from '@/lib/marketing/generator'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const projectId = new URL(req.url).searchParams.get('projectId')
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 })

  const project = await prisma.project.findFirst({ where: { id: projectId, userId: session.user.id } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const calendars = await prisma.contentCalendar.findMany({
    where: { projectId },
    include: { posts: { orderBy: { scheduledAt: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(calendars)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectId } = await req.json()

  const project = await prisma.project.findFirst({ where: { id: projectId, userId: session.user.id } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const calendarItems = await generateContentCalendar({
    name: project.name,
    description: project.description,
    deployedUrl: project.deployedUrl,
  })

  const startDate = new Date()
  const endDate = new Date()
  endDate.setDate(endDate.getDate() + 30)

  const calendar = await prisma.contentCalendar.create({
    data: {
      projectId,
      name: `${project.name} — 30-Day Launch Calendar`,
      startDate,
      endDate,
    },
  })

  // Create all posts
  const platformMap: Record<string, string> = { twitter: 'TWITTER', linkedin: 'LINKEDIN', reddit: 'REDDIT', email: 'EMAIL' }

  await Promise.all(
    calendarItems.map((item) => {
      const platform = platformMap[item.platform] ?? 'TWITTER'
      const scheduledAt = new Date(startDate)
      scheduledAt.setDate(scheduledAt.getDate() + item.day - 1)
      const [hours, minutes] = (item.scheduledTime ?? '9:00 AM').replace(' AM', '').replace(' PM', '').split(':').map(Number)
      scheduledAt.setHours(hours, minutes ?? 0, 0, 0)

      return prisma.marketingPost.create({
        data: {
          projectId,
          calendarId: calendar.id,
          platform: platform as any,
          content: item.content,
          scheduledAt,
          status: 'SCHEDULED',
        },
      })
    })
  )

  const result = await prisma.contentCalendar.findUnique({
    where: { id: calendar.id },
    include: { posts: { orderBy: { scheduledAt: 'asc' } } },
  })

  return NextResponse.json(result, { status: 201 })
}
