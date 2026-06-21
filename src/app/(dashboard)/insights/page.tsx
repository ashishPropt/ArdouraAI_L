'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Brain, FileSearch, MessageSquare, FileText, Loader2, RefreshCw, ChevronRight, Play, X } from 'lucide-react'

type InsightType = 'POSTMORTEM' | 'CODE_REVIEW' | 'ADVISOR' | 'COST_ANALYSIS'
interface Project { id: string; name: string }
interface InsightData {
  id: string; type: InsightType; title: string; content: string
  createdAt: string; project: { id: string; name: string }
}

const TYPE_CONFIG: Record<InsightType, { label: string; icon: React.ReactNode; color: string; endpoint: string }> = {
  POSTMORTEM:   { label: 'Postmortem',   icon: <FileText className="w-4 h-4" />,    color: 'text-red-400 bg-red-900/20',     endpoint: '/api/insights/postmortem' },
  CODE_REVIEW:  { label: 'Code Review',  icon: <FileSearch className="w-4 h-4" />,  color: 'text-blue-400 bg-blue-900/20',   endpoint: '/api/insights/review' },
  ADVISOR:      { label: 'Advisor',      icon: <MessageSquare className="w-4 h-4" />, color: 'text-green-400 bg-green-900/20', endpoint: '/api/insights/advisor' },
  COST_ANALYSIS:{ label: 'Cost Analysis',icon: <Brain className="w-4 h-4" />,       color: 'text-yellow-400 bg-yellow-900/20', endpoint: '/api/insights/advisor' },
}

export default function InsightsPage() {
  const [insights, setInsights] = useState<InsightData[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<InsightData | null>(null)

  const [genType, setGenType] = useState<InsightType>('ADVISOR')
  const [genProject, setGenProject] = useState('')
  const [genQuestion, setGenQuestion] = useState('')
  const [generating, setGenerating] = useState(false)
  const [stream, setStream] = useState('')
  const streamRef = useRef('')

  const load = useCallback(async () => {
    setLoading(true)
    const [iRes, pRes] = await Promise.all([fetch('/api/insights'), fetch('/api/projects')])
    if (iRes.ok) setInsights(await iRes.json())
    if (pRes.ok) {
      const ps = await pRes.json()
      setProjects(ps)
      if (ps.length > 0 && !genProject) setGenProject(ps[0].id)
    }
    setLoading(false)
  }, [genProject])

  useEffect(() => { load() }, [load])

  async function generate() {
    if (!genProject) return
    setGenerating(true)
    setStream('')
    streamRef.current = ''
    setSelected(null)

    const body: Record<string, unknown> = { projectId: genProject }
    if (genType === 'ADVISOR' && genQuestion) body.question = genQuestion

    const res = await fetch(TYPE_CONFIG[genType].endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.body) { setGenerating(false); return }
    const reader = res.body.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const text = decoder.decode(value)
      for (const line of text.split('\n')) {
        if (!line.startsWith('data: ')) continue
        try {
          const evt = JSON.parse(line.slice(6))
          if (evt.text) {
            streamRef.current += evt.text
            setStream(streamRef.current)
          }
          if (evt.done) {
            await load()
          }
        } catch {}
      }
    }
    setGenerating(false)
  }

  function renderMarkdown(md: string) {
    return md
      .replace(/^## (.+)$/gm, '<h2 class="text-base font-bold text-white mt-4 mb-2">$1</h2>')
      .replace(/^### (.+)$/gm, '<h3 class="text-sm font-semibold text-slate-300 mt-3 mb-1">$1</h3>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/🔴/g, '<span class="text-red-400">🔴</span>')
      .replace(/🟠/g, '<span class="text-orange-400">🟠</span>')
      .replace(/🟡/g, '<span class="text-yellow-400">🟡</span>')
      .replace(/🟢/g, '<span class="text-green-400">🟢</span>')
      .replace(/^- (.+)$/gm, '<li class="ml-4 text-sm text-slate-300">$1</li>')
      .replace(/\n/g, '<br/>')
  }

  return (
    <div className="flex h-full">
      {/* Left: generate + history */}
      <div className="w-80 border-r border-slate-800 flex flex-col">
        <div className="p-4 border-b border-slate-800">
          <h1 className="font-semibold text-white flex items-center gap-2">
            <Brain className="w-5 h-5 text-ardoura-400" /> AI Insights
          </h1>
        </div>

        {/* Generator */}
        <div className="p-4 border-b border-slate-800 space-y-3">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Type</label>
            <select value={genType} onChange={e => setGenType(e.target.value as InsightType)} className="w-full border border-slate-700 rounded-lg px-3 py-2 text-sm bg-slate-800 text-white">
              <option value="ADVISOR">Advisor Assessment</option>
              <option value="POSTMORTEM">Incident Postmortem</option>
              <option value="CODE_REVIEW">Code Review</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Project</label>
            <select value={genProject} onChange={e => setGenProject(e.target.value)} className="w-full border border-slate-700 rounded-lg px-3 py-2 text-sm bg-slate-800 text-white">
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          {genType === 'ADVISOR' && (
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Question <span className="text-slate-600">(optional)</span></label>
              <textarea value={genQuestion} onChange={e => setGenQuestion(e.target.value)} placeholder="What should I optimize next?" rows={2} className="w-full border border-slate-700 rounded-lg px-3 py-2 text-xs bg-slate-800 text-white placeholder-slate-500 resize-none" />
            </div>
          )}
          <button onClick={generate} disabled={generating || !genProject} className="w-full flex items-center justify-center gap-2 bg-ardoura-600 hover:bg-ardoura-500 disabled:opacity-50 text-white text-sm py-2 rounded-lg transition-colors">
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Generate
          </button>
        </div>

        {/* History */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>
          ) : insights.length === 0 ? (
            <p className="p-4 text-xs text-slate-500 text-center">No insights yet. Generate one above.</p>
          ) : (
            insights.map(ins => {
              const cfg = TYPE_CONFIG[ins.type]
              return (
                <button key={ins.id} onClick={() => { setSelected(ins); setStream('') }} className={`w-full text-left p-3 border-b border-slate-800 hover:bg-slate-800/50 transition-colors ${selected?.id === ins.id ? 'bg-slate-800/70' : ''}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 ${cfg.color}`}>{cfg.icon}{cfg.label}</span>
                  </div>
                  <p className="text-xs text-white truncate">{ins.title}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{ins.project.name} · {new Date(ins.createdAt).toLocaleDateString()}</p>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Right: content */}
      <div className="flex-1 overflow-y-auto p-6">
        {generating ? (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Loader2 className="w-4 h-4 animate-spin text-ardoura-400" />
              <span className="text-sm text-slate-400">Generating {TYPE_CONFIG[genType].label}…</span>
            </div>
            <div className="prose prose-invert max-w-none text-sm text-slate-300 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(stream) }} />
          </div>
        ) : selected ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-white">{selected.title}</h2>
                <p className="text-xs text-slate-500 mt-0.5">{selected.project.name} · {new Date(selected.createdAt).toLocaleString()}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-slate-600 hover:text-slate-300"><X className="w-4 h-4" /></button>
            </div>
            <div className="prose prose-invert max-w-none text-sm text-slate-300 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(selected.content) }} />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <Brain className="w-12 h-12 mb-3 opacity-20" />
            <p className="text-sm">Select an insight or generate a new one</p>
          </div>
        )}
      </div>
    </div>
  )
}
