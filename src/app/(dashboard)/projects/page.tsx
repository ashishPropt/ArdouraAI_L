import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'
import { ProjectsGrid } from '@/components/dashboard/ProjectsGrid'

export default async function ProjectsPage() {
  const session = await auth()
  const projects = await prisma.project.findMany({
    where: { userId: session!.user.id },
    orderBy: { updatedAt: 'desc' },
    include: { _count: { select: { messages: true, files: true } } },
  })

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Your Projects</h1>
          <p className="text-slate-400 mt-1">Click a project to continue building, or create a new one.</p>
        </div>
        <ProjectsGrid projects={projects as any} />
      </div>
    </div>
  )
}
