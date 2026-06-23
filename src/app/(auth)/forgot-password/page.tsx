'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Mail, Loader2, ArrowLeft } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Request failed')
        setLoading(false)
        return
      }

      setSent(true)
    } catch (err) {
      setError('Network error')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-ardoura-950 via-ardoura-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/login" className="inline-flex items-center gap-2 text-ardoura-400 hover:text-ardoura-300 mb-6 text-sm">
            <ArrowLeft className="w-4 h-4" />
            Back to login
          </Link>
          <h1 className="text-2xl font-bold text-white">Reset password</h1>
          <p className="text-ardoura-300 mt-1 text-sm">Enter your email to receive a reset link</p>
        </div>

        <div className="bg-ardoura-900/50 border border-ardoura-800/50 rounded-2xl p-8 backdrop-blur-sm">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 bg-ardoura-600/20 rounded-full flex items-center justify-center mx-auto">
                <Mail className="w-6 h-6 text-ardoura-400" />
              </div>
              <div>
                <h2 className="text-white font-semibold mb-1">Check your email</h2>
                <p className="text-ardoura-300 text-sm">
                  We've sent a password reset link to <span className="font-mono text-ardoura-200">{email}</span>
                </p>
              </div>
              <p className="text-ardoura-400 text-xs pt-4">
                Link expires in 24 hours. Didn't receive it?{' '}
                <button
                  onClick={() => setSent(false)}
                  className="text-ardoura-300 hover:text-white transition-colors underline"
                >
                  Try again
                </button>
              </p>
            </div>
          ) : (
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
                {loading ? 'Sending...' : 'Send reset link'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
