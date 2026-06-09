'use client'

import { useEffect, useState } from 'react'

interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}

let listeners: ((toasts: Toast[]) => void)[] = []
let toasts: Toast[] = []

export function toast(message: string, type: Toast['type'] = 'info') {
  const t: Toast = { id: Date.now().toString(), message, type }
  toasts = [...toasts, t]
  listeners.forEach((l) => l(toasts))
  setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== t.id)
    listeners.forEach((l) => l(toasts))
  }, 4000)
}

export function Toaster() {
  const [list, setList] = useState<Toast[]>([])

  useEffect(() => {
    const fn = (t: Toast[]) => setList([...t])
    listeners.push(fn)
    return () => { listeners = listeners.filter((l) => l !== fn) }
  }, [])

  if (list.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {list.map((t) => (
        <div
          key={t.id}
          className={`px-4 py-3 rounded-xl text-sm text-white shadow-lg animate-fade-in ${
            t.type === 'success' ? 'bg-green-600' : t.type === 'error' ? 'bg-red-600' : 'bg-slate-700'
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  )
}
