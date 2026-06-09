import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth/config'
import { prisma } from '@/lib/db/prisma'
import { pushProjectToGitHub } from '@/lib/github/client'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authConfig)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectId } = await req.json()

  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: session.user.id },
    include: { files: true },
  })

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  if (project.files.length === 0) return NextResponse.json({ error: 'No files generated yet' }, { status: 400 })

  // Determine GitHub owner and token
  const githubToken = user?.githubToken || process.env.GITHUB_TOKEN
  const githubOwner = user?.githubUsername || process.env.GITHUB_OWNER || 'protxchange'

  try {
    const repoUrl = await pushProjectToGitHub(
      githubToken,
      githubOwner,
      project.name,
      {
        projectName: project.name,
        description: project.description || '',
        files: project.files.map((f) => ({ path: f.path, content: f.content, language: f.language || 'text' })),
        setupCommands: [],
        envVars: [],
      }
    )

    // Save repo info to project
    await prisma.project.update({
      where: { id: projectId },
      data: { githubRepo: repoUrl, githubOwner },
    })

    return NextResponse.json({ url: repoUrl })
  } catch (err: any) {
    console.error('GitHub push error:', err)
    return NextResponse.json({ error: err.message || 'Failed to push to GitHub' }, { status: 500 })
  }
}
