'use client'

import { useEffect, useState, useCallback } from 'react'
import { Server, RefreshCw, Loader2, Power, Cpu, HardDrive, Wifi, Plus, AlertCircle } from 'lucide-react'

interface Instance {
  id: string
  label: string
  status: string
  power: string
  ip: string
  plan: string
  region: string
  ram: number
  vcpu: number
  disk: number
  os: string
  created: string
}

const STATUS_DOT: Record<string, string> = {
  active: 'bg-green-500',
  pending: 'bg-yellow-500',
  suspended: 'bg-red-500',
}

const POWER_DOT: Record<string, string> = {
  running: 'bg-green-400',
  stopped: 'bg-slate-400',
}

export default function CloudPage() {
  const [instances, setInstances] = useState<Instance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [acting, setActing] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  const fetchInstances = useCallback(async () => {
    setLoading(true)
    setError('')
    const res = await fetch('/api/cloud/instances')
    if (res.ok) {
      setInstances((await res.json()).instances ?? [])
    } else {
      const err = await res.json()
      setError(err.error ?? 'Failed to load instances')
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchInstances() }, [fetchInstances])

  async function doAction(action: string, instanceId: string, label: string) {
    setActing(instanceId)
    const res = await fetch('/api/cloud/instances', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, instanceId }),
    })
    const data = await res.json()
    if (data.queued) {
      setToast(`"${label}" ${action.replace(/_/g, ' ')} queued for approval — check Incidents`)
    } else if (!data.success) {
      setToast(`Error: ${data.error}`)
    } else {
      setToast(`${action.replace(/_/g, ' ')} initiated for "${label}"`)
    }
    setActing(null)
    setTimeout(() => setToast(''), 5000)
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Cloud Manager</h1>
          <p className="text-sm text-muted-foreground mt-1">Vultr VPS instances — mutating actions require HITL approval</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => doAction('create_instance', '', 'new instance')}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90"
          >
            <Plus className="w-4 h-4" /> New Instance
          </button>
          <button onClick={fetchInstances} className="flex items-center gap-2 border px-3 py-2 rounded-lg text-sm hover:bg-muted">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {toast && (
        <div className="mb-4 px-4 py-3 bg-blue-50 border border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 rounded-xl text-sm text-blue-700 dark:text-blue-300">
          {toast}
        </div>
      )}

      {error && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-300">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
          {error.includes('integration') && (
            <a href="/integrations" className="underline ml-1">Add Vultr integration →</a>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : instances.length === 0 && !error ? (
        <div className="border border-dashed rounded-xl p-12 text-center text-muted-foreground">
          <Server className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No instances found</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {instances.map(instance => (
            <div key={instance.id} className="border rounded-xl p-4 bg-card">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                    <Server className="w-5 h-5 text-slate-300" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{instance.label}</span>
                      <span className={`w-2 h-2 rounded-full ${STATUS_DOT[instance.status] ?? 'bg-slate-400'}`} title={instance.status} />
                      <span className={`w-2 h-2 rounded-full ${POWER_DOT[instance.power] ?? 'bg-slate-400'}`} title={instance.power} />
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Wifi className="w-3 h-3" />{instance.ip}</span>
                      <span className="flex items-center gap-1"><Cpu className="w-3 h-3" />{instance.vcpu} vCPU · {Math.round(instance.ram / 1024)}GB RAM</span>
                      <span className="flex items-center gap-1"><HardDrive className="w-3 h-3" />{instance.disk}GB SSD</span>
                      <span>{instance.region.toUpperCase()} · {instance.plan}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{instance.os}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => doAction('reboot_instance', instance.id, instance.label)}
                    disabled={acting === instance.id}
                    className="flex items-center gap-1.5 border px-3 py-1.5 rounded-lg text-sm hover:bg-muted disabled:opacity-50"
                    title="Reboot (requires approval)"
                  >
                    {acting === instance.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Power className="w-3.5 h-3.5" />}
                    Reboot
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground mt-4 text-center">
        Reboot, resize, and delete actions are queued to the HITL approval queue in Incidents.
      </p>
    </div>
  )
}
