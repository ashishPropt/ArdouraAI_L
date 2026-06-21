'use client'

import { useState } from 'react'
import { ExternalLink, Globe, Loader2, Server, X, Zap, Copy, Check, Terminal } from 'lucide-react'
import { VULTR_PLANS, VULTR_REGIONS } from '@/lib/vultr/client'

interface Props {
  project: { id: string; name: string; deployedUrl: string | null; vultrIp: string | null }
  onClose: () => void
  onDeployed: (url: string) => void
}

export function DeployModal({ project, onClose, onDeployed }: Props) {
  const [mode, setMode] = useState<'existing' | 'new'>('existing')
  const [plan, setPlan] = useState('vc2-1c-2gb')
  const [region, setRegion] = useState('ewr')
  const [customApiKey, setCustomApiKey] = useState('')
  const [deploying, setDeploying] = useState(false)
  const [result, setResult] = useState<{ ip: string; url: string } | null>(null)
  const [script, setScript] = useState<string | null>(null)
  const [steps, setSteps] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  async function handleDeploy() {
    setDeploying(true)
    setError('')
    const res = await fetch('/api/deploy/vultr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: project.id,
        plan,
        region,
        vultrApiKey: mode === 'new' ? customApiKey : undefined,
      }),
    })
    const data = await res.json()
    if (res.ok) {
      setResult({ ip: data.ip, url: data.url })
      onDeployed(data.url)
      // Fetch setup script
      const setupRes = await fetch('/api/deploy/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id }),
      })
      if (setupRes.body) {
        const reader = setupRes.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n'); buffer = lines.pop() || ''
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const d = JSON.parse(line.slice(6))
            if (d.type === 'script') setScript(d.content)
            if (d.type === 'instructions') setSteps(d.steps)
          }
        }
      }
    } else {
      setError(data.error || 'Deployment failed')
    }
    setDeploying(false)
  }

  async function copyScript() {
    if (!script) return
    await navigator.clipboard.writeText(script)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-ardoura-800 rounded-lg flex items-center justify-center">
              <Server className="w-4 h-4 text-ardoura-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Deploy to Vultr</h2>
              <p className="text-xs text-slate-400">{project.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {result ? (
          <div className="p-5 overflow-y-auto max-h-[70vh]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-green-500/10 rounded-full flex items-center justify-center flex-shrink-0">
                <Globe className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-white font-semibold">VPS provisioned!</p>
                <p className="text-xs text-slate-400">Allow 2-3 minutes for the server to boot</p>
              </div>
            </div>

            <div className="bg-slate-800 rounded-xl p-3 mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">IP</p>
                <p className="text-white font-mono text-sm">{result.ip}</p>
              </div>
              <a href={result.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-ardoura-400 hover:text-ardoura-300 text-xs">
                {result.url} <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {steps.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Next steps</p>
                <ol className="space-y-1">
                  {steps.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                      <span className="bg-ardoura-700 text-white w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 text-[10px]">{i + 1}</span>
                      {s}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {script && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                    <Terminal className="w-3 h-3" /> Bootstrap Script
                  </p>
                  <button onClick={copyScript} className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors">
                    {copied ? <><Check className="w-3 h-3 text-green-400" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                  </button>
                </div>
                <pre className="bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs text-green-300 font-mono overflow-x-auto whitespace-pre max-h-48 overflow-y-auto">
                  {script}
                </pre>
              </div>
            )}

            <button onClick={onClose} className="mt-4 w-full bg-ardoura-600 hover:bg-ardoura-500 text-white py-2 rounded-lg text-sm font-medium transition-colors">
              Done
            </button>
          </div>
        ) : (
          <div className="p-5 space-y-5">
            {/* Account mode selector */}
            <div>
              <p className="text-xs font-medium text-slate-400 mb-2">Vultr Account</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setMode('existing')}
                  className={`p-3 rounded-xl border text-left transition-colors ${
                    mode === 'existing' ? 'border-ardoura-500 bg-ardoura-900/30' : 'border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <p className="text-sm font-medium text-white">My account</p>
                  <p className="text-xs text-slate-500 mt-0.5">Use connected Vultr</p>
                </button>
                <button
                  onClick={() => setMode('new')}
                  className={`p-3 rounded-xl border text-left transition-colors ${
                    mode === 'new' ? 'border-ardoura-500 bg-ardoura-900/30' : 'border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-white">New account</p>
                    <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full font-medium">$250 credit</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">Provide your API key</p>
                </button>
              </div>
            </div>

            {mode === 'new' && (
              <div className="bg-ardoura-900/20 border border-ardoura-800/50 rounded-xl p-4">
                <div className="flex items-start gap-2 mb-3">
                  <Zap className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-slate-300">
                    Create a Vultr account and get <strong className="text-white">$250 free credit</strong> for your first month.{' '}
                    <a href="https://www.vultr.com/?ref=ardoura" target="_blank" rel="noopener noreferrer" className="text-ardoura-400 hover:underline">
                      Sign up here →
                    </a>
                  </p>
                </div>
                <input
                  type="text"
                  value={customApiKey}
                  onChange={(e) => setCustomApiKey(e.target.value)}
                  placeholder="Paste your Vultr API key"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-ardoura-500 font-mono"
                />
              </div>
            )}

            {/* Region */}
            <div>
              <p className="text-xs font-medium text-slate-400 mb-2">Region</p>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-ardoura-500"
              >
                {VULTR_REGIONS.map((r) => (
                  <option key={r.id} value={r.id}>{r.flag} {r.name}</option>
                ))}
              </select>
            </div>

            {/* Plan */}
            <div>
              <p className="text-xs font-medium text-slate-400 mb-2">Server Size</p>
              <div className="space-y-2">
                {VULTR_PLANS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPlan(p.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-colors ${
                      plan === p.id ? 'border-ardoura-500 bg-ardoura-900/30' : 'border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-white">{p.name}</p>
                      {p.recommended && (
                        <span className="text-[10px] bg-ardoura-500/20 text-ardoura-300 px-1.5 py-0.5 rounded-full">Recommended</span>
                      )}
                    </div>
                    <span className="text-sm text-slate-400">{p.price}</span>
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              onClick={handleDeploy}
              disabled={deploying || (mode === 'new' && !customApiKey)}
              className="w-full bg-ardoura-600 hover:bg-ardoura-500 disabled:opacity-50 text-white py-2.5 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2"
            >
              {deploying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Server className="w-4 h-4" />}
              {deploying ? 'Creating server...' : 'Deploy now'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
