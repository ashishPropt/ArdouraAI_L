'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Code2, Clock, FileText, Github, Globe, Plus, Trash2 } from 'lucide-react'
import { formatDistanceToNow } from '@/lib/utils'

interface Project {
  id: string
  name: string
  description: string | null
  status: string
  githubRepo: string | null
  deployedUrl: string | null
  updatedAt: string
  _count: { messages: number; files: number }
}

export function ProjectsGrid({ projects }: { projects: Project[] }) {
  const router = useRouter()

  async function deleteProject(id: string, e: React.MouseEvent) {
    e.preventDefault()
    if (!confirm('Delete this project?')) return
    await fetch(`/api/projects/${id}`, { method: 'DELETE' })
    router.refresh()
  }

  async function createProject() {
    const name = prompt('What are you building?')
    if (!name) return
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    const project = await res.json()
    router.push(`/project/${project.id}`)
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* New project card */}
      <button
        onClick={createProject}
        className="border-2 border-dashed border-slate-700 hover:border-ardoura-500 rounded-2xl p-6 text-center transition-all group"
      >
        <div className="w-12 h-12 bg-slate-800 group-hover:bg-ardoura-800 rounded-xl flex items-center justify-center mx-auto mb-3 transition-colors">
          <Plus className="w-6 h-6 text-slate-400 group-hover:text-ardoura-300" />
        </div>
        <p className="text-slate-400 group-hover:text-white font-medium transition-colors">New project</p>
        <p className="text-slate-600 text-sm mt-1">Chat your idea, get code</p>
      </button>

      {projects.map((project) => (
        <Link
          key={project.id}
          href={`/project/${project.id}`}
          className="bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-ardoura-600/50 rounded-2xl p-5 transition-all group relative"
        >
          <button
            onClick={(e) => deleteProject(project.id, e)}
            className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 p-1 rounded transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          <div className="w-10 h-10 bg-ardoura-800 rounded-xl flex items-center justify-center mb-3">
            <Code2 className="w-5 h-5 text-ardoura-400" />
          </div>

          <h3 className="font-semibold text-white truncate pr-6">{project.name}</h3>
          {project.description && (
            <p className="text-slate-400 text-sm mt-1 line-clamp-2">{project.description}</p>
          )}

          <div className="flex items-center gap-3 mt-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <FileText className="w-3 h-3" />
              {project._count.files} files
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDistanceToNow(new Date(project.updatedAt))}
            </span>
          </div>

          <div className="flex gap-2 mt-3">
            {project.githubRepo && (
              <span className="flex items-center gap-1 text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">
                <Github className="w-3 h-3" /> GitHub
              </span>
            )}
            {project.deployedUrl && (
              <span className="flex items-center gap-1 text-xs text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-full">
                <Globe className="w-3 h-3" /> Live
              </span>
            )}
          </div>
        </Link>
      ))}
    </div>
  )
}
