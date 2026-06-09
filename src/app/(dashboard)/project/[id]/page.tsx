import { notFound } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'
import { ProjectWorkspace } from '@/components/chat/ProjectWorkspace'

export default async function ProjectPage({ params }: { params: { id: string } }) {
  const session = await auth()

  const project = await prisma.project.findFirst({
    where: { id: params.id, userId: session!.user.id },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
      files: { orderBy: { path: 'asc' } },
    },
  })

  if (!project) notFound()

  return <ProjectWorkspace project={project as any} />
}
