'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Cpu, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const res = await signIn('credentials', { email, password, redirect: false })

    if (res?.error) {
      setError('Invalid email or password')
      setLoading(false)
    } else {
      router.push('/projects')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-ardoura-950 via-ardoura-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-8 h-8 bg-ardoura-500 rounded-lg flex items-center justify-center">
              <Cpu className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white tracking-tight">ArdouraAI</span>
          </Link>
          <h1 className="text-2xl font-bold text-white">Welcome back</h1>
          <p className="text-ardoura-300 mt-1 text-sm">Sign in to continue building</p>
        </div>

        <div className="bg-ardoura-900/50 border border-ardoura-800/50 rounded-2xl p-8 backdrop-blur-sm">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-ardoura-200 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-ardoura-800/50 border border-ardoura-700/50 rounded-xl px-4 py-2.5 text-white placeholder-ardoura-500 focus:outline-none focus:border-ardoura-500 transition-colors"
                placeholder="you@example.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ardoura-200 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-ardoura-800/50 border border-ardoura-700/50 rounded-xl px-4 py-2.5 text-white placeholder-ardoura-500 focus:outline-none focus:border-ardoura-500 transition-colors"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-ardoura-500 hover:bg-ardoura-400 disabled:opacity-50 text-white py-2.5 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <p className="text-center text-ardoura-400 text-sm mt-6">
            No account?{' '}
            <Link href="/register" className="text-ardoura-300 hover:text-white transition-colors font-medium">
              Create one free
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
