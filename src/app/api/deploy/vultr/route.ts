import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth/config'
import { prisma } from '@/lib/db/prisma'
import { createInstance, getInstance, validateApiKey, getAccount } from '@/lib/vultr/client'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authConfig)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectId, plan, region, vultrApiKey: customKey } = await req.json()

  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: session.user.id },
  })

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  // Determine which API key to use: user's own > owner's default
  const apiKey = customKey || user?.vultrApiKey || process.env.VULTR_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'No Vultr API key configured' }, { status: 400 })

  try {
    const instance = await createInstance(apiKey, project.name, plan || 'vc2-1c-2gb', region || 'ewr')

    await prisma.project.update({
      where: { id: projectId },
      data: {
        vultrInstanceId: instance.id,
        vultrIp: instance.ip,
        status: 'DEPLOYED',
        deployedUrl: `http://${instance.ip}`,
      },
    })

    return NextResponse.json({
      instanceId: instance.id,
      ip: instance.ip,
      url: `http://${instance.ip}`,
      status: instance.status,
      message: 'Instance created. Allow 2-3 minutes for provisioning.',
    })
  } catch (err: any) {
    console.error('Vultr deploy error:', err)
    return NextResponse.json(
      { error: err.response?.data?.error || err.message || 'Deployment failed' },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authConfig)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const apiKey = searchParams.get('apiKey') || process.env.VULTR_API_KEY!

  const valid = await validateApiKey(apiKey)
  if (!valid) return NextResponse.json({ error: 'Invalid API key' }, { status: 400 })

  const account = await getAccount(apiKey)
  return NextResponse.json({ valid: true, account })
}
