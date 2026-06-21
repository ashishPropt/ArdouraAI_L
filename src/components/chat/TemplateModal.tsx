'use client'

import { useEffect, useState } from 'react'
import { X, Loader2, Check } from 'lucide-react'

interface Template {
  id: string
  name: string
  description: string
  icon: string
  tags: string[]
  fileCount: number
  setupCommands: string[]
  envVars: { key: string; description: string }[]
}

interface Props {
  projectId: string
  onApplied: (files: any[]) => void
  onClose: () => void
}

export function TemplateModal({ projectId, onApplied, onClose }: Props) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [applying, setApplying] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    fetch('/api/templates').then(r => r.json()).then(d => setTemplates(d.templates))
  }, [])

  async function applyTemplate() {
    if (!selected) return
    setApplying(true)
    const res = await fetch('/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, templateId: selected }),
    })
    if (res.ok) {
      const data = await res.json()
      setDone(true)
      setTimeout(() => {
        onApplied(data.files)
        onClose()
      }, 800)
    }
    setApplying(false)
  }

  const selectedTemplate = templates.find(t => t.id === selected)

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between p-5 border-b border-slate-800 flex-shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-white">Start from a Template</h2>
            <p className="text-xs text-slate-400 mt-0.5">Pick a scaffold to load into your project</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Template list */}
          <div className="w-64 flex-shrink-0 border-r border-slate-800 overflow-y-auto p-3 space-y-2">
            {templates.map(t => (
              <button
                key={t.id}
                onClick={() => setSelected(t.id)}
                className={`w-full text-left p-3 rounded-xl border transition-colors ${
                  selected === t.id
                    ? 'border-ardoura-500 bg-ardoura-900/30'
                    : 'border-slate-700 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">{t.icon}</span>
                  <span className="text-sm font-medium text-white truncate">{t.name}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {t.tags.slice(0, 2).map(tag => (
                    <span key={tag} className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded-full">{tag}</span>
                  ))}
                </div>
              </button>
            ))}
          </div>

          {/* Template detail */}
          <div className="flex-1 overflow-y-auto p-5">
            {selectedTemplate ? (
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl">{selectedTemplate.icon}</span>
                  <div>
                    <h3 className="text-base font-semibold text-white">{selectedTemplate.name}</h3>
                    <p className="text-xs text-slate-400">{selectedTemplate.fileCount} files</p>
                  </div>
                </div>
                <p className="text-sm text-slate-300 mb-4">{selectedTemplate.description}</p>

                <div className="flex flex-wrap gap-1.5 mb-4">
                  {selectedTemplate.tags.map(tag => (
                    <span key={tag} className="text-xs bg-ardoura-900/40 text-ardoura-300 px-2 py-0.5 rounded-full border border-ardoura-800">{tag}</span>
                  ))}
                </div>

                {selectedTemplate.setupCommands.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Setup</p>
                    <div className="bg-slate-800 rounded-lg p-3 space-y-1">
                      {selectedTemplate.setupCommands.map((cmd, i) => (
                        <p key={i} className="text-xs font-mono text-green-400">$ {cmd}</p>
                      ))}
                    </div>
                  </div>
                )}

                {selectedTemplate.envVars.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Environment Variables</p>
                    <div className="space-y-1.5">
                      {selectedTemplate.envVars.map(v => (
                        <div key={v.key} className="flex items-start gap-2">
                          <code className="text-xs text-yellow-400 bg-slate-800 px-1.5 py-0.5 rounded font-mono flex-shrink-0">{v.key}</code>
                          <span className="text-xs text-slate-400">{v.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-600">
                <p className="text-sm">Select a template to preview</p>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-slate-800 flex justify-end gap-3 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 rounded-lg transition-colors">
            Cancel
          </button>
          <button
            onClick={applyTemplate}
            disabled={!selected || applying || done}
            className="px-6 py-2 text-sm font-medium bg-ardoura-600 hover:bg-ardoura-500 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            {done ? <><Check className="w-4 h-4" /> Applied!</> : applying ? <><Loader2 className="w-4 h-4 animate-spin" /> Applying…</> : 'Apply Template'}
          </button>
        </div>
      </div>
    </div>
  )
}
