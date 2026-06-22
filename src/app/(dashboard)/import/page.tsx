'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Upload, Globe, FileText, Loader2, CheckCircle2, AlertCircle,
  ArrowRight, Tag, LayoutGrid, FileEdit, ChevronRight, Database,
  Navigation, Image, Layers,
} from 'lucide-react'

type Step = 'form' | 'previewing' | 'previewed' | 'generating' | 'done' | 'error'
type Method = 'file' | 'url'

interface PreviewData {
  title: string
  description: string
  url: string
  counts: { posts: number; pages: number; categories: number; tags: number; media: number; customPostTypes: number; menus: number }
  homepage: string
  pages: { title: string; slug: string; hasContent: boolean; hasFeaturedImage: boolean; parentId: number }[]
  samplePosts: { title: string; slug: string; date: string; categories: string[]; author: string; hasFeaturedImage: boolean }[]
  menus: { name: string; itemCount: number; topLevel: string[] }[]
  customPostTypes: string[]
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
            <p className="text-slate-400 text-sm">Convert your full WordPress site to React + Node.js + PostgreSQL</p>
          </div>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8 text-xs">
        {(['form', 'previewed', 'done'] as const).map((s, i) => {
          const labels = ['Connect', 'Preview', 'Generate']
          const active = s === 'form' && ['form', 'previewing', 'error'].includes(step)
            || s === 'previewed' && ['previewed', 'generating'].includes(step)
            || s === 'done' && step === 'done'
          const done = (s === 'form' && ['previewed', 'generating', 'done'].includes(step))
            || (s === 'previewed' && step === 'done')
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

      {/* Done */}
      {step === 'done' && (
        <div className="bg-green-900/20 border border-green-700/40 rounded-2xl p-8 text-center">
          <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Import Complete!</h2>
          <p className="text-slate-400 mb-1">{filesGenerated} files generated for <strong className="text-white">{preview?.title}</strong></p>
          <p className="text-slate-500 text-sm mb-6">Your complete React + Node.js + PostgreSQL site is ready.</p>
          <button
            onClick={() => router.push(`/project/${projectId}`)}
            className="inline-flex items-center gap-2 bg-ardoura-600 hover:bg-ardoura-500 text-white px-6 py-3 rounded-xl font-semibold transition-colors"
          >
            Open Project <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Generating */}
      {step === 'generating' && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8 text-center">
          <Loader2 className="w-12 h-12 text-ardoura-400 mx-auto mb-4 animate-spin" />
          <h2 className="text-xl font-bold text-white mb-2">Converting Your Site</h2>
          <p className="text-slate-400 mb-1">Building <strong className="text-white">{preview?.title}</strong> — {preview?.counts.pages} pages, {preview?.counts.posts} posts...</p>
          <p className="text-slate-500 text-sm">This takes 30–90 seconds. The AI is generating every page route, the navigation, and all content.</p>
          <div className="mt-6 grid grid-cols-2 gap-2 max-w-sm mx-auto text-xs text-slate-500">
            {['DB schema + seed SQL', 'Express API routes', `${preview?.counts.pages} React page components`, 'Navigation from WP menus', 'Blog + category pages', 'Content import script'].map(s => (
              <div key={s} className="flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" />
                {s}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preview */}
      {step === 'previewed' && preview && (
        <div className="space-y-4">
          {/* Site card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-white">{preview.title}</h2>
                {preview.description && <p className="text-slate-400 text-sm mt-0.5">{preview.description}</p>}
                <p className="text-slate-500 text-xs mt-1">{preview.url}</p>
                <span className="inline-block mt-2 text-xs bg-ardoura-900/40 text-ardoura-300 border border-ardoura-700/40 px-2 py-0.5 rounded-full">
                  Homepage: {preview.homepage}
                </span>
              </div>
              <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[
                { icon: FileText, label: 'Posts', value: preview.counts.posts },
                { icon: FileEdit, label: 'Pages', value: preview.counts.pages },
                { icon: LayoutGrid, label: 'Categories', value: preview.counts.categories },
                { icon: Navigation, label: 'Menus', value: preview.counts.menus },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="bg-slate-900/60 rounded-xl p-3 text-center">
                  <Icon className="w-4 h-4 text-ardoura-400 mx-auto mb-1" />
                  <p className="text-xl font-bold text-white">{value}</p>
                  <p className="text-xs text-slate-500">{label}</p>
                </div>
              ))}
            </div>
            {(preview.counts.media > 0 || preview.customPostTypes.length > 0) && (
              <div className="flex gap-3 mt-2">
                {preview.counts.media > 0 && (
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Image className="w-3 h-3" /> {preview.counts.media} media items
                  </span>
                )}
                {preview.customPostTypes.length > 0 && (
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Layers className="w-3 h-3" /> Custom types: {preview.customPostTypes.join(', ')}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Pages — ALL of them since these all get React routes */}
          <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
              <FileEdit className="w-3.5 h-3.5 text-ardoura-400" />
              Pages — each becomes a React route
            </h3>
            <div className="space-y-1.5">
              {preview.pages.map(p => (
                <div key={p.slug} className="flex items-center justify-between text-sm py-1 border-b border-slate-700/30 last:border-0">
                  <div className="flex items-center gap-2">
                    {p.parentId > 0 && <span className="text-slate-600 text-xs pl-4">↳</span>}
                    <span className="text-white font-medium">{p.title}</span>
                    <span className="text-xs text-slate-500 font-mono">/{p.slug}</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {p.hasContent && <span className="text-xs bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded">content</span>}
                    {p.hasFeaturedImage && <span className="text-xs bg-blue-900/40 text-blue-400 px-1.5 py-0.5 rounded">image</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Menus */}
          {preview.menus.length > 0 && (
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                <Navigation className="w-3.5 h-3.5 text-ardoura-400" />
                Navigation Menus
              </h3>
              {preview.menus.map((m, i) => (
                <div key={i} className="mb-3 last:mb-0">
                  <p className="text-xs font-medium text-slate-400 mb-1">{m.name} ({m.itemCount} items)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {m.topLevel.map(label => (
                      <span key={label} className="text-xs bg-slate-700/60 text-slate-300 px-2 py-0.5 rounded-full">{label}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Sample posts */}
          {preview.samplePosts.length > 0 && (
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-ardoura-400" />
                Blog Posts ({preview.counts.posts} total)
              </h3>
              <div className="space-y-1.5">
                {preview.samplePosts.map(p => (
                  <div key={p.slug} className="flex items-center justify-between text-sm py-1 border-b border-slate-700/30 last:border-0">
                    <span className="text-white truncate max-w-xs">{p.title}</span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {p.hasFeaturedImage && <Image className="w-3 h-3 text-blue-400" />}
                      {p.categories.slice(0, 2).map(c => (
                        <span key={c} className="text-xs bg-ardoura-900/40 text-ardoura-300 px-1.5 py-0.5 rounded-full">{c}</span>
                      ))}
                      <span className="text-xs text-slate-500">{p.date?.slice(0, 10)}</span>
                    </div>
                  </div>
                ))}
                {preview.counts.posts > 5 && <p className="text-xs text-slate-500 pt-1">+ {preview.counts.posts - 5} more posts</p>}
              </div>
            </div>
          )}

          {/* What gets generated */}
          <div className="bg-ardoura-900/20 border border-ardoura-700/30 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-ardoura-300 mb-3">What will be generated</h3>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
              {[
                `${preview.counts.pages} React page components (one per WP page)`,
                'Navigation from your exact WP menu structure',
                'Homepage matches your WP front page setting',
                'Blog listing + individual post pages',
                'Category archive pages',
                'db/schema.sql — PostgreSQL tables',
                'db/seed.sql — categories & tags',
                'Express API: pages, posts, categories, nav',
                'scripts/import-content.js — full content seeder',
                'README.md with setup steps',
              ].map(item => (
                <div key={item} className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-ardoura-400 flex-shrink-0 mt-0.5" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={() => setStep('form')} className="px-4 py-2.5 border border-slate-600 hover:border-slate-400 text-slate-400 hover:text-white rounded-xl text-sm transition-colors">
              Back
            </button>
            <button onClick={handleGenerate} className="flex-1 flex items-center justify-center gap-2 bg-ardoura-600 hover:bg-ardoura-500 text-white py-2.5 rounded-xl font-semibold text-sm transition-colors">
              Generate Full Site <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Form */}
      {['form', 'previewing', 'error'].includes(step) && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setMethod('url')} className={`p-4 rounded-2xl border text-left transition-colors ${method === 'url' ? 'border-ardoura-500 bg-ardoura-900/30' : 'border-slate-700 hover:border-slate-600 bg-slate-800/30'}`}>
              <Globe className={`w-5 h-5 mb-2 ${method === 'url' ? 'text-ardoura-400' : 'text-slate-500'}`} />
              <p className="text-sm font-semibold text-white">Live Site URL</p>
              <p className="text-xs text-slate-500 mt-0.5">Import from a live WordPress site via REST API</p>
            </button>
            <button onClick={() => setMethod('file')} className={`p-4 rounded-2xl border text-left transition-colors ${method === 'file' ? 'border-ardoura-500 bg-ardoura-900/30' : 'border-slate-700 hover:border-slate-600 bg-slate-800/30'}`}>
              <Upload className={`w-5 h-5 mb-2 ${method === 'file' ? 'text-ardoura-400' : 'text-slate-500'}`} />
              <p className="text-sm font-semibold text-white">Upload WXR File</p>
              <p className="text-xs text-slate-500 mt-0.5">WordPress export XML (Tools → Export → All content)</p>
            </button>
          </div>

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
              <div onClick={() => fileRef.current?.click()} className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${file ? 'border-ardoura-600 bg-ardoura-900/20' : 'border-slate-700 hover:border-slate-500 bg-slate-800/20'}`}>
                {file ? (
                  <><FileText className="w-8 h-8 text-ardoura-400 mx-auto mb-2" /><p className="text-white font-medium text-sm">{file.name}</p><p className="text-slate-500 text-xs mt-1">{(file.size / 1024).toFixed(0)} KB</p></>
                ) : (
                  <><Upload className="w-8 h-8 text-slate-600 mx-auto mb-2" /><p className="text-slate-400 text-sm">Click to select your WordPress export XML</p><p className="text-slate-600 text-xs mt-1">In WordPress: Tools → Export → All content → Download</p></>
                )}
              </div>
              <input ref={fileRef} type="file" accept=".xml" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
            </div>
          )}

          {step === 'error' && error && (
            <div className="flex items-start gap-2.5 bg-red-950/30 border border-red-700/40 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          <button
            onClick={handlePreview}
            disabled={step === 'previewing' || (method === 'url' ? !url : !file)}
            className="w-full flex items-center justify-center gap-2 bg-ardoura-600 hover:bg-ardoura-500 disabled:opacity-50 text-white py-3 rounded-xl font-semibold text-sm transition-colors"
          >
            {step === 'previewing'
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Scanning WordPress site...</>
              : <>Preview Import <ArrowRight className="w-4 h-4" /></>}
          </button>

          <div className="bg-slate-800/30 border border-slate-700/40 rounded-xl p-4 text-xs text-slate-500 space-y-2">
            <p className="text-slate-400 font-medium">What gets imported:</p>
            <p>Every page with its full HTML content · Navigation menus · All blog posts · Categories & tags · Featured images · Custom post types · Homepage setting</p>
            <p className="text-slate-400 font-medium mt-1">Generated stack:</p>
            <p>React + Vite · React Router (one route per page) · Express.js API · PostgreSQL · Tailwind CSS with Typography</p>
          </div>
        </div>
      )}
    </div>
  )
}
