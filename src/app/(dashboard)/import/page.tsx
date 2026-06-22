'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Upload, Globe, FileText, Loader2, CheckCircle2, AlertCircle,
  ArrowRight, Tag, LayoutGrid, FileEdit, ChevronRight, Database,
} from 'lucide-react'

type Step = 'form' | 'previewing' | 'previewed' | 'generating' | 'done' | 'error'
type Method = 'file' | 'url'

interface PreviewData {
  title: string
  description: string
  url: string
  counts: { posts: number; pages: number; categories: number; tags: number }
  samplePosts: { title: string; slug: string; date: string; categories: string[]; author: string }[]
  samplePages: { title: string; slug: string }[]
  categories: { name: string; slug: string; count: number }[]
}

export default function ImportPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [method, setMethod] = useState<Method>('url')
  const [url, setUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [step, setStep] = useState<Step>('form')
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [error, setError] = useState('')
  const [projectId, setProjectId] = useState('')
  const [filesGenerated, setFilesGenerated] = useState(0)

  async function handlePreview() {
    setError('')
    setStep('previewing')
    try {
      let res: Response
      if (method === 'url') {
        res = await fetch('/api/import/wordpress/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        })
      } else {
        if (!file) { setError('Please select a file'); setStep('form'); return }
        const form = new FormData()
        form.append('file', file)
        res = await fetch('/api/import/wordpress/preview', { method: 'POST', body: form })
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Preview failed')
      setPreview(data)
      setStep('previewed')
    } catch (e: any) {
      setError(e.message)
      setStep('error')
    }
  }

  async function handleGenerate() {
    if (!preview) return
    setError('')
    setStep('generating')
    try {
      let res: Response
      if (method === 'url') {
        res = await fetch('/api/import/wordpress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        })
      } else {
        const form = new FormData()
        form.append('file', file!)
        res = await fetch('/api/import/wordpress', { method: 'POST', body: form })
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Import failed')
      setProjectId(data.projectId)
      setFilesGenerated(data.filesGenerated)
      setStep('done')
    } catch (e: any) {
      setError(e.message)
      setStep('error')
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center">
            <Database className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">WordPress Import</h1>
            <p className="text-slate-400 text-sm">Convert any WordPress site to React + Node.js + PostgreSQL</p>
          </div>
        </div>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-2 mb-8 text-xs">
        {(['form', 'previewed', 'done'] as const).map((s, i) => {
          const labels = ['Connect', 'Preview', 'Generate']
          const active = step === s || (s === 'form' && ['previewing'].includes(step)) || (s === 'previewed' && step === 'generating')
          const done = (s === 'form' && ['previewed', 'generating', 'done'].includes(step)) || (s === 'previewed' && step === 'done')
          return (
            <div key={s} className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-colors ${
                done ? 'border-green-600 bg-green-900/20 text-green-400' :
                active ? 'border-ardoura-500 bg-ardoura-900/30 text-ardoura-300' :
                'border-slate-700 text-slate-600'
              }`}>
                {done ? <CheckCircle2 className="w-3 h-3" /> : <span className="w-4 text-center">{i + 1}</span>}
                {labels[i]}
              </div>
              {i < 2 && <ChevronRight className="w-3 h-3 text-slate-700" />}
            </div>
          )
        })}
      </div>

      {/* Success state */}
      {step === 'done' && (
        <div className="bg-green-900/20 border border-green-700/40 rounded-2xl p-8 text-center">
          <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Import Complete!</h2>
          <p className="text-slate-400 mb-1">{filesGenerated} files generated for <strong className="text-white">{preview?.title}</strong></p>
          <p className="text-slate-500 text-sm mb-6">Your React + Node.js + PostgreSQL app is ready to browse and deploy.</p>
          <button
            onClick={() => router.push(`/project/${projectId}`)}
            className="inline-flex items-center gap-2 bg-ardoura-600 hover:bg-ardoura-500 text-white px-6 py-3 rounded-xl font-semibold transition-colors"
          >
            Open Project <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Generating state */}
      {step === 'generating' && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8 text-center">
          <Loader2 className="w-12 h-12 text-ardoura-400 mx-auto mb-4 animate-spin" />
          <h2 className="text-xl font-bold text-white mb-2">Generating Your App</h2>
          <p className="text-slate-400 mb-1">Converting <strong className="text-white">{preview?.title}</strong> to React + Node.js + PostgreSQL...</p>
          <p className="text-slate-500 text-sm">This takes 30–60 seconds. Hang tight.</p>
          <div className="mt-6 flex justify-center gap-6 text-xs text-slate-500">
            {['Schema & seed SQL', 'Express API routes', 'React components', 'Content import script'].map(s => (
              <div key={s} className="flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" />
                {s}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preview state */}
      {step === 'previewed' && preview && (
        <div className="space-y-5">
          {/* Site summary card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-white">{preview.title}</h2>
                {preview.description && <p className="text-slate-400 text-sm mt-0.5">{preview.description}</p>}
                {preview.url && <p className="text-slate-500 text-xs mt-1">{preview.url}</p>}
              </div>
              <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
            </div>

            {/* Counts */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { icon: FileText, label: 'Posts', value: preview.counts.posts },
                { icon: FileEdit, label: 'Pages', value: preview.counts.pages },
                { icon: LayoutGrid, label: 'Categories', value: preview.counts.categories },
                { icon: Tag, label: 'Tags', value: preview.counts.tags },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="bg-slate-900/60 rounded-xl p-3 text-center">
                  <Icon className="w-4 h-4 text-ardoura-400 mx-auto mb-1" />
                  <p className="text-xl font-bold text-white">{value}</p>
                  <p className="text-xs text-slate-500">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Sample posts */}
          {preview.samplePosts.length > 0 && (
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                <FileText className="w-3.5 h-3.5" /> Sample Posts
              </h3>
              <div className="space-y-2">
                {preview.samplePosts.map(p => (
                  <div key={p.slug} className="flex items-center justify-between text-sm py-1.5 border-b border-slate-700/40 last:border-0">
                    <span className="text-white font-medium truncate max-w-xs">{p.title}</span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {p.categories.slice(0, 2).map(c => (
                        <span key={c} className="text-xs bg-ardoura-900/40 text-ardoura-300 px-2 py-0.5 rounded-full">{c}</span>
                      ))}
                      <span className="text-xs text-slate-500">{p.date?.slice(0, 10)}</span>
                    </div>
                  </div>
                ))}
                {preview.counts.posts > 5 && (
                  <p className="text-xs text-slate-500 pt-1">+ {preview.counts.posts - 5} more posts will be imported</p>
                )}
              </div>
            </div>
          )}

          {/* Categories */}
          {preview.categories.length > 0 && (
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                <LayoutGrid className="w-3.5 h-3.5" /> Categories
              </h3>
              <div className="flex flex-wrap gap-2">
                {preview.categories.map(c => (
                  <span key={c.slug} className="inline-flex items-center gap-1 text-xs bg-slate-700/60 text-slate-300 px-2.5 py-1 rounded-full">
                    {c.name}
                    {c.count > 0 && <span className="text-slate-500">({c.count})</span>}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* What will be generated */}
          <div className="bg-ardoura-900/20 border border-ardoura-700/30 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-ardoura-300 mb-3">What will be generated</h3>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
              {[
                'db/schema.sql — PostgreSQL tables',
                'db/seed.sql — categories & tags',
                'scripts/import-content.js — content seeder',
                'server/index.js — Express API server',
                'server/routes/ — posts, pages, categories',
                'client/src/pages/ — Home, Post, Page, Category',
                'client/src/components/ — Header, Footer, PostCard',
                'README.md — full setup guide',
              ].map(item => (
                <div key={item} className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-ardoura-400 flex-shrink-0 mt-0.5" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setStep('form')}
              className="px-4 py-2.5 border border-slate-600 hover:border-slate-400 text-slate-400 hover:text-white rounded-xl text-sm transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleGenerate}
              className="flex-1 flex items-center justify-center gap-2 bg-ardoura-600 hover:bg-ardoura-500 text-white py-2.5 rounded-xl font-semibold text-sm transition-colors"
            >
              Generate App <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Form state */}
      {(step === 'form' || step === 'previewing' || step === 'error') && (
        <div className="space-y-6">
          {/* Method selector */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setMethod('url')}
              className={`p-4 rounded-2xl border text-left transition-colors ${
                method === 'url' ? 'border-ardoura-500 bg-ardoura-900/30' : 'border-slate-700 hover:border-slate-600 bg-slate-800/30'
              }`}
            >
              <Globe className={`w-5 h-5 mb-2 ${method === 'url' ? 'text-ardoura-400' : 'text-slate-500'}`} />
              <p className="text-sm font-semibold text-white">Live Site URL</p>
              <p className="text-xs text-slate-500 mt-0.5">Import from a live WordPress site via REST API</p>
            </button>
            <button
              onClick={() => setMethod('file')}
              className={`p-4 rounded-2xl border text-left transition-colors ${
                method === 'file' ? 'border-ardoura-500 bg-ardoura-900/30' : 'border-slate-700 hover:border-slate-600 bg-slate-800/30'
              }`}
            >
              <Upload className={`w-5 h-5 mb-2 ${method === 'file' ? 'text-ardoura-400' : 'text-slate-500'}`} />
              <p className="text-sm font-semibold text-white">Upload WXR File</p>
              <p className="text-xs text-slate-500 mt-0.5">WordPress export XML (Tools → Export → All content)</p>
            </button>
          </div>

          {/* Input area */}
          {method === 'url' ? (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2">WordPress Site URL</label>
              <input
                type="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && url && handlePreview()}
                placeholder="https://yourwordpresssite.com or .../wp-json"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-ardoura-500 text-sm"
                disabled={step === 'previewing'}
              />
              <p className="text-xs text-slate-500 mt-1.5">Enter your site domain or paste the full <code className="text-slate-400">domain/wp-json</code> URL — both work</p>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2">WordPress Export File (.xml)</label>
              <div
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  file ? 'border-ardoura-600 bg-ardoura-900/20' : 'border-slate-700 hover:border-slate-500 bg-slate-800/20'
                }`}
              >
                {file ? (
                  <>
                    <FileText className="w-8 h-8 text-ardoura-400 mx-auto mb-2" />
                    <p className="text-white font-medium text-sm">{file.name}</p>
                    <p className="text-slate-500 text-xs mt-1">{(file.size / 1024).toFixed(0)} KB</p>
                  </>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-slate-400 text-sm">Click to select your WordPress export XML</p>
                    <p className="text-slate-600 text-xs mt-1">In WordPress: Tools → Export → All content → Download</p>
                  </>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".xml"
                className="hidden"
                onChange={e => setFile(e.target.files?.[0] || null)}
              />
            </div>
          )}

          {/* Error */}
          {step === 'error' && error && (
            <div className="flex items-start gap-2.5 bg-red-950/30 border border-red-700/40 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handlePreview}
            disabled={step === 'previewing' || (method === 'url' ? !url : !file)}
            className="w-full flex items-center justify-center gap-2 bg-ardoura-600 hover:bg-ardoura-500 disabled:opacity-50 text-white py-3 rounded-xl font-semibold text-sm transition-colors"
          >
            {step === 'previewing' ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Connecting to WordPress...</>
            ) : (
              <>Preview Import <ArrowRight className="w-4 h-4" /></>
            )}
          </button>

          {/* Info banner */}
          <div className="bg-slate-800/30 border border-slate-700/40 rounded-xl p-4 text-xs text-slate-500 space-y-1">
            <p className="text-slate-400 font-medium">What gets imported:</p>
            <p>All published posts, pages, categories, and tags. Featured images, authors, excerpts, and full HTML content are preserved.</p>
            <p className="mt-2 text-slate-400 font-medium">Generated stack:</p>
            <p>React + Vite frontend · Express.js REST API · PostgreSQL database · Tailwind CSS styling</p>
          </div>
        </div>
      )}
    </div>
  )
}
