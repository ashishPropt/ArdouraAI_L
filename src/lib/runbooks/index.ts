export type RunbookStepType = 'mcp_action' | 'shell' | 'wait' | 'notify'

export interface RunbookStep {
  id: string
  type: RunbookStepType
  description: string
  // mcp_action fields
  tool?: string
  action?: string
  params?: Record<string, unknown>
  // shell fields
  command?: string
  // wait fields
  durationMs?: number
  // Rollback counterpart step id
  rollbackStepId?: string
}

export interface Runbook {
  id: string
  name: string
  description: string
  /** fixType values this runbook handles */
  fixTypes: string[]
  /** Keywords in title/description that trigger this runbook */
  triggerKeywords: string[]
  steps: RunbookStep[]
  rollbackSteps: RunbookStep[]
  estimatedDurationMs: number
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
}

export const RUNBOOKS: Runbook[] = [
  {
    id: 'oom-restart',
    name: 'OOM — Restart Application',
    description: 'Handles out-of-memory crashes by gracefully restarting the PM2 process and clearing caches.',
    fixTypes: ['OOM', 'CRASH'],
    triggerKeywords: ['out of memory', 'oom', 'killed', 'memory limit', 'heap', 'crash'],
    riskLevel: 'LOW',
    estimatedDurationMs: 15_000,
    steps: [
      { id: 's1', type: 'notify', description: 'Send alert: starting OOM recovery' },
      { id: 's2', type: 'shell', description: 'Graceful PM2 reload', command: 'pm2 reload all --update-env' },
      { id: 's3', type: 'wait', description: 'Wait 5s for process to stabilize', durationMs: 5000 },
      { id: 's4', type: 'shell', description: 'Verify process is online', command: 'pm2 status --no-color' },
    ],
    rollbackSteps: [
      { id: 'r1', type: 'shell', description: 'Force restart all processes', command: 'pm2 restart all' },
    ],
  },
  {
    id: 'high-cpu',
    name: 'High CPU — Identify & Throttle',
    description: 'Identifies top CPU consumers, logs diagnostics, and optionally scales down background jobs.',
    fixTypes: ['SCALE_UP'],
    triggerKeywords: ['high cpu', 'cpu spike', 'cpu usage', '100%', 'throttle', 'slow response'],
    riskLevel: 'MEDIUM',
    estimatedDurationMs: 30_000,
    steps: [
      { id: 's1', type: 'shell', description: 'Capture top 10 CPU processes', command: 'ps aux --sort=-%cpu | head -11' },
      { id: 's2', type: 'shell', description: 'Capture PM2 metrics', command: 'pm2 monit --no-interact 2>&1 | head -40' },
      { id: 's3', type: 'notify', description: 'Notify with diagnostics' },
      { id: 's4', type: 'shell', description: 'Reload workers gracefully', command: 'pm2 reload all' },
    ],
    rollbackSteps: [
      { id: 'r1', type: 'shell', description: 'Restart all', command: 'pm2 restart all' },
    ],
  },
  {
    id: 'disk-full',
    name: 'Disk Full — Clean Logs & Temp Files',
    description: 'Frees disk space by rotating logs, clearing npm cache, and removing old build artifacts.',
    fixTypes: ['DISK'],
    triggerKeywords: ['disk full', 'no space', 'disk space', 'enospc', 'filesystem'],
    riskLevel: 'LOW',
    estimatedDurationMs: 20_000,
    steps: [
      { id: 's1', type: 'shell', description: 'Show disk usage', command: 'df -h && du -sh /tmp /var/log /root/.npm 2>/dev/null' },
      { id: 's2', type: 'shell', description: 'Rotate PM2 logs', command: 'pm2 flush' },
      { id: 's3', type: 'shell', description: 'Clean npm cache', command: 'npm cache clean --force 2>/dev/null || true' },
      { id: 's4', type: 'shell', description: 'Remove /tmp files older than 7 days', command: 'find /tmp -mtime +7 -delete 2>/dev/null || true' },
      { id: 's5', type: 'shell', description: 'Verify disk freed', command: 'df -h' },
    ],
    rollbackSteps: [],
  },
  {
    id: 'http-5xx-spike',
    name: 'HTTP 5xx Spike — Restart & Health Check',
    description: 'Responds to 5xx error spikes by restarting the app and verifying the health endpoint.',
    fixTypes: ['CUSTOM'],
    triggerKeywords: ['500', '502', '503', '504', '5xx', 'error rate', 'gateway', 'service unavailable'],
    riskLevel: 'MEDIUM',
    estimatedDurationMs: 25_000,
    steps: [
      { id: 's1', type: 'shell', description: 'Check recent PM2 error logs', command: 'pm2 logs --err --lines 50 --nostream 2>/dev/null || true' },
      { id: 's2', type: 'shell', description: 'Restart application', command: 'pm2 restart all' },
      { id: 's3', type: 'wait', description: 'Wait 10s for startup', durationMs: 10_000 },
      { id: 's4', type: 'shell', description: 'Health check', command: 'curl -sf http://localhost:3000/health && echo "OK" || echo "FAIL"' },
    ],
    rollbackSteps: [
      { id: 'r1', type: 'shell', description: 'Pull previous deployment', command: 'cd /opt/app && git stash && npm run build && pm2 restart all' },
    ],
  },
  {
    id: 'deploy-fail',
    name: 'Deploy Failure — Rollback to Last Good',
    description: 'Rolls back to the previous git commit, rebuilds, and restarts when a deployment fails.',
    fixTypes: ['CODE_PATCH'],
    triggerKeywords: ['deploy fail', 'build failed', 'deploy error', 'rollback', 'revert'],
    riskLevel: 'HIGH',
    estimatedDurationMs: 120_000,
    steps: [
      { id: 's1', type: 'shell', description: 'Show last 5 commits', command: 'git log --oneline -5' },
      { id: 's2', type: 'shell', description: 'Revert to previous commit', command: 'git revert HEAD --no-edit' },
      { id: 's3', type: 'shell', description: 'Reinstall dependencies', command: 'npm install --legacy-peer-deps' },
      { id: 's4', type: 'shell', description: 'Rebuild', command: 'npm run build' },
      { id: 's5', type: 'shell', description: 'Restart PM2', command: 'pm2 restart all' },
      { id: 's6', type: 'wait', description: 'Wait 10s', durationMs: 10_000 },
      { id: 's7', type: 'shell', description: 'Health check', command: 'curl -sf http://localhost:3000/health || echo "DEGRADED"' },
    ],
    rollbackSteps: [
      { id: 'r1', type: 'shell', description: 'Restore original commit', command: 'git revert HEAD --no-edit && npm run build && pm2 restart all' },
    ],
  },
]

export function matchRunbook(fixType: string, title: string, description: string): Runbook | null {
  const text = `${title} ${description}`.toLowerCase()
  for (const rb of RUNBOOKS) {
    if (rb.fixTypes.includes(fixType)) return rb
    if (rb.triggerKeywords.some(kw => text.includes(kw))) return rb
  }
  return null
}
