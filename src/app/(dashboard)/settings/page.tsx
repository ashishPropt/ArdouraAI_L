'use client'

import { useEffect, useState } from 'react'
import { Github, Loader2, Save, Server } from 'lucide-react'

interface Settings {
  name: string
  email: string
  githubUsername: string
  githubToken?: string
  vultrApiKey: string
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({ name: '', email: '', githubUsername: '', vultrApiKey: '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/user/settings').then(r => r.json()).then(setSettings)
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await fetch('/api/user/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-1">Settings</h1>
        <p className="text-slate-400 text-sm mb-8">Configure your integrations and account.</p>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Profile */}
          <section className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-white mb-4">Profile</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Name</label>
                <input
                  value={settings.name || ''}
                  onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-ardoura-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Email</label>
                <input
                  value={settings.email || ''}
                  disabled
                  className="w-full bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-500 text-sm cursor-not-allowed"
                />
              </div>
            </div>
          </section>

          {/* GitHub */}
          <section className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Github className="w-4 h-4 text-slate-400" />
              <h2 className="text-sm font-semibold text-white">GitHub Integration</h2>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Generated code will be pushed to your GitHub. If not set, code is saved to the owner's GitHub.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">GitHub Username</label>
                <input
                  value={settings.githubUsername || ''}
                  onChange={(e) => setSettings({ ...settings, githubUsername: e.target.value })}
                  placeholder="your-github-username"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-ardoura-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Personal Access Token{' '}
                  <a
                    href="https://github.com/settings/tokens/new?scopes=repo&description=ArdouraAI"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-ardoura-400 hover:underline"
                  >
                    Generate one →
                  </a>
                </label>
                <input
                  type="password"
                  value={settings.githubToken || ''}
                  onChange={(e) => setSettings({ ...settings, githubToken: e.target.value })}
                  placeholder="ghp_..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-ardoura-500 transition-colors font-mono"
                />
              </div>
            </div>
          </section>

          {/* Vultr */}
          <section className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Server className="w-4 h-4 text-slate-400" />
              <h2 className="text-sm font-semibold text-white">Vultr Deployment</h2>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Your Vultr API key for deploying generated apps. Don't have an account?{' '}
              <a href="https://www.vultr.com/?ref=ardoura" target="_blank" rel="noopener noreferrer" className="text-ardoura-400 hover:underline">
                Sign up and get $250 free →
              </a>
            </p>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Vultr API Key</label>
              <input
                type="password"
                value={settings.vultrApiKey || ''}
                onChange={(e) => setSettings({ ...settings, vultrApiKey: e.target.value })}
                placeholder="Your Vultr API key"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-ardoura-500 transition-colors font-mono"
              />
            </div>
          </section>

          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-ardoura-600 hover:bg-ardoura-500 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl font-semibold text-sm transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saved ? 'Saved!' : saving ? 'Saving...' : 'Save settings'}
          </button>
        </form>
      </div>
    </div>
  )
}
