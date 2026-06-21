'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Code2, Github, Globe, Loader2, MessageSquare, RefreshCw, Server, LayoutTemplate } from 'lucide-react'
import { DeployModal } from '@/components/deploy/DeployModal'
import { TemplateModal } from './TemplateModal'

interface Project {
  id: string
  name: string
  githubRepo: string | null
  deployedUrl: string | null
  vultrIp: string | null
}

interface Props {
  project: Project
  filesCount: number
  generating: boolean
  activePanel: 'chat' | 'code'
  setActivePanel: (p: 'chat' | 'code') => void
  onGenerate: () => void
  onProjectUpdate: (p: any) => void
  onFilesLoaded?: (files: any[]) => void
}

export function ProjectToolbar({
  project, filesCount, generating, activePanel, setActivePanel, onGenerate, onProjectUpdate, onFilesLoaded,
}: Props) {
  const router = useRouter()
  const [pushingGitHub, setPushingGitHub] = useState(false)
  const [githubUrl, setGithubUrl] = useState(project.githubRepo)
  const [showDeploy, setShowDeploy] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)

  async function pushToGitHub() {
    setPushingGitHub(true)
    const res = await fetch('/api/github/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: project.id }),
    })
    const data = await res.json()
    if (data.url) {
      setGithubUrl(data.url)
      onProjectUpdate({ ...project, githubRepo: data.url })
    }
    setPushingGitHub(false)
  }

  return (
    <>
      <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex-shrink-0">
        <button
          onClick={() => router.push('/dashboard')}
          className="text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <span className="text-sm font-semibold text-white truncate max-w-xs">{project.name}</span>

        <div className="flex items-center gap-1 ml-2 bg-slate-800 rounded-lg p-0.5">
          <button
            onClick={() => setActivePanel('chat')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors ${
              activePanel === 'chat' ? 'bg-ardoura-700 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Chat
          </button>
          <button
            onClick={() => setActivePanel('code')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors ${
              activePanel === 'code' ? 'bg-ardoura-700 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            Code {filesCount > 0 && <span className="bg-ardoura-600 text-white px-1 rounded text-[10px]">{filesCount}</span>}
          </button>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => setShowTemplates(true)}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 px-3 py-1.5 rounded-lg transition-colors"
          >
            <LayoutTemplate className="w-3.5 h-3.5" />
            Templates
          </button>

          {filesCount > 0 && (
            <button
              onClick={onGenerate}
              disabled={generating}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 px-3 py-1.5 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} />
              Regenerate
            </button>
          )}

          {filesCount > 0 && (
            <button
              onClick={pushToGitHub}
              disabled={pushingGitHub}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors border ${
                githubUrl
                  ? 'border-green-700/50 text-green-400 hover:border-green-600'
                  : 'border-slate-700 text-slate-400 hover:text-white hover:border-slate-500'
              }`}
            >
              {pushingGitHub ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Github className="w-3.5 h-3.5" />}
              {githubUrl ? 'Pushed' : 'Push to GitHub'}
            </button>
          )}

          {filesCount > 0 && (
            <button
              onClick={() => setShowDeploy(true)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors font-medium ${
                project.deployedUrl
                  ? 'bg-blue-700/30 border border-blue-700/50 text-blue-300 hover:border-blue-600'
                  : 'bg-ardoura-600 hover:bg-ardoura-500 text-white'
              }`}
            >
              {project.deployedUrl ? (
                <><Globe className="w-3.5 h-3.5" /> Live</>
              ) : (
                <><Server className="w-3.5 h-3.5" /> Deploy</>
              )}
            </button>
          )}
        </div>
      </div>

      {showDeploy && (
        <DeployModal
          project={project}
          onClose={() => setShowDeploy(false)}
          onDeployed={(url) => onProjectUpdate({ ...project, deployedUrl: url })}
        />
      )}

      {showTemplates && (
        <TemplateModal
          projectId={project.id}
          onApplied={(files) => { onFilesLoaded?.(files); setShowTemplates(false) }}
          onClose={() => setShowTemplates(false)}
        />
      )}
    </>
  )
}
