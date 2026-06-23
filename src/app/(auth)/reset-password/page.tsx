'use client'

import { useState, useSearchParams } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, ArrowLeft } from 'lucide-react'

export default function ResetPasswordPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!token) {
      setError('Invalid reset link')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Reset failed')
        setLoading(false)
        return
      }

      setSuccess(true)
      setTimeout(() => router.push('/login'), 2000)
    } catch (err) {
      setError('Network error')
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-ardoura-950 via-ardoura-900 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Invalid reset link</h1>
          <p className="text-ardoura-300 mb-6">This password reset link is not valid</p>
          <Link href="/login" className="text-ardoura-400 hover:text-ardoura-300">
            Back to login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-ardoura-950 via-ardoura-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/login" className="inline-flex items-center gap-2 text-ardoura-400 hover:text-ardoura-300 mb-6 text-sm">
            <ArrowLeft className="w-4 h-4" />
            Back to login
          </Link>
          <h1 className="text-2xl font-bold text-white">Create new password</h1>
          <p className="text-ardoura-300 mt-1 text-sm">Enter your new password below</p>
        </div>

        <div className="bg-ardoura-900/50 border border-ardoura-800/50 rounded-2xl p-8 backdrop-blur-sm">
          {success ? (
            <div className="text-center space-y-4">
              <div className="text-5xl">✓</div>
              <h2 className="text-white font-semibold">Password reset successful</h2>
              <p className="text-ardoura-300 text-sm">Redirecting to login...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-ardoura-200 mb-1.5">New Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-ardoura-800/50 border border-ardoura-700/50 rounded-xl px-4 py-2.5 text-white placeholder-ardoura-500 focus:outline-none focus:border-ardoura-500 transition-colors"
                  placeholder="••••••••"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ardoura-200 mb-1.5">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
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
                {loading ? 'Resetting...' : 'Reset password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
