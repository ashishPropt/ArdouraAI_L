import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'
import { TEMPLATES, getTemplate } from '@/lib/templates'

export async function GET() {
  return NextResponse.json({ templates: TEMPLATES.map(t => ({
    id: t.id, name: t.name, description: t.description, icon: t.icon, tags: t.tags,
    fileCount: t.files.length, setupCommands: t.setupCommands, envVars: t.envVars,
  })) })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectId, templateId } = await req.json()
  if (!projectId || !templateId) return NextResponse.json({ error: 'projectId and templateId required' }, { status: 400 })

  const template = getTemplate(templateId)
  if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 })

  const project = await prisma.project.findFirst({ where: { id: projectId, userId: session.user.id } })
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  // Upsert all template files
  for (const file of template.files) {
    await prisma.projectFile.upsert({
      where: { projectId_path: { projectId, path: file.path } },
      create: { projectId, path: file.path, content: file.content, language: file.language },
      update: { content: file.content, language: file.language },
    })
  }

  const files = await prisma.projectFile.findMany({ where: { projectId }, orderBy: { path: 'asc' } })
  return NextResponse.json({ files, template: { name: template.name, setupCommands: template.setupCommands, envVars: template.envVars } })
}
