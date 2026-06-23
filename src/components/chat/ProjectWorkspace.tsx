'use client'

import { useState, useRef, useEffect } from 'react'
import { ChatPanel } from './ChatPanel'
import { CodePanel } from './CodePanel'
import { ProjectToolbar } from './ProjectToolbar'

interface Message {
  id: string
  role: 'USER' | 'ASSISTANT' | 'SYSTEM'
  content: string
  createdAt: string
  metadata?: any
}

interface ProjectFile {
  id: string
  path: string
  content: string
  language: string | null
}

interface Project {
  id: string
  name: string
  description: string | null
  githubRepo: string | null
  deployedUrl: string | null
  vultrIp: string | null
  messages: Message[]
  files: ProjectFile[]
}

export function ProjectWorkspace({ project: initial }: { project: Project }) {
  const [messages, setMessages] = useState<Message[]>(initial.messages)
  const [files, setFiles] = useState<ProjectFile[]>(initial.files)
  const [project, setProject] = useState(initial)
  const [generating, setGenerating] = useState(false)
  const [selectedFile, setSelectedFile] = useState<ProjectFile | null>(initial.files[0] || null)
  const [activePanel, setActivePanel] = useState<'chat' | 'code'>('chat')

  async function handleSend(text: string) {
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'USER',
      content: text,
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMsg])

    const assistantMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: 'ASSISTANT',
      content: '',
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, assistantMsg])

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: project.id, message: text }),
    })

    if (!res.ok || !res.body) {
      setMessages((prev) => {
        const msgs = [...prev]
        msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content: '❌ Failed to reach the AI. Please try again.' }
        return msgs
      })
      return
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let shouldGenerate = false

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = JSON.parse(line.slice(6))
        if (data.type === 'chunk') {
          setMessages((prev) => {
            const msgs = [...prev]
            msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content: msgs[msgs.length - 1].content + data.text }
            return msgs
          })
        } else if (data.type === 'done') {
          shouldGenerate = data.shouldGenerate
        }
      }
    }

    if (shouldGenerate) {
      await runGeneration()
    }
  }

  async function runGeneration() {
    setGenerating(true)
    setActivePanel('code')

    const statusMsg: Message = {
      id: Date.now().toString(),
      role: 'SYSTEM',
      content: 'Generating your application...',
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, statusMsg])

    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: project.id }),
    })

    if (!res.body) { setGenerating(false); return }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = JSON.parse(line.slice(6))
        if (data.type === 'status') {
          setMessages((prev) => {
            const msgs = [...prev]
            msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content: data.message }
            return msgs
          })
        } else if (data.type === 'complete') {
          const newFiles = data.files.map((f: any, i: number) => ({
            id: `gen-${i}`,
            path: f.path,
            content: f.content,
            language: f.language,
          }))
          setFiles(newFiles)
          setSelectedFile(newFiles[0] || null)
          setMessages((prev) => {
            const msgs = [...prev]
            msgs[msgs.length - 1] = {
              ...msgs[msgs.length - 1],
              content: `✅ Generated ${data.files.length} files for **${data.projectName}**!\n\nYou can now:\n- Browse the files in the code panel\n- Push to GitHub\n- Deploy to Vultr\n- Ask me to make changes`,
            }
            return msgs
          })
        } else if (data.type === 'error') {
          setMessages((prev) => {
            const msgs = [...prev]
            msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content: `❌ Error: ${data.message}` }
            return msgs
          })
        }
      }
    }

    setGenerating(false)
  }

  return (
    <div className="flex flex-col h-full">
      <ProjectToolbar
        project={project}
        filesCount={files.length}
        onGenerate={runGeneration}
        generating={generating}
        activePanel={activePanel}
        setActivePanel={setActivePanel}
        onProjectUpdate={setProject}
        onFilesLoaded={(newFiles) => {
          const mapped = newFiles.map((f: any) => ({ id: f.id, path: f.path, content: f.content, language: f.language }))
          setFiles(mapped)
          setSelectedFile(mapped[0] || null)
          setActivePanel('code')
        }}
      />
      <div className="flex-1 flex overflow-hidden">
        <div className={`${activePanel === 'chat' ? 'flex-1' : 'w-80 flex-shrink-0'} flex flex-col border-r border-slate-800`}>
          <ChatPanel
            messages={messages}
            onSend={handleSend}
            disabled={generating}
            projectName={project.name}
          />
        </div>
        <div className={`${activePanel === 'code' ? 'flex-1' : 'flex-1'} flex flex-col`}>
          <CodePanel
            projectId={project.id}
            files={files}
            selectedFile={selectedFile}
            onSelectFile={setSelectedFile}
            onFileUpdated={(updated) => {
              setFiles(prev => prev.map(f => f.id === updated.id ? updated : f))
              setSelectedFile(updated)
            }}
          />
        </div>
      </div>
    </div>
  )
}
