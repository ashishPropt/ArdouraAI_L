import type { TopicName } from './topics'

export interface BaseEvent {
  id: string
  topic: TopicName
  source: string
  timestamp: string
  projectId?: string
  userId?: string
}

// Observability
export interface AlertTriggeredEvent extends BaseEvent {
  alertName: string
  severity: 'P1' | 'P2' | 'P3' | 'P4'
  metric: string
  value: number
  threshold: number
  instanceIp?: string
  service?: string
  message: string
  rawPayload?: unknown
}

export interface MetricSpikeEvent extends BaseEvent {
  metric: string
  value: number
  baseline: number
  spikeFactor: number
  instanceIp?: string
}

export interface LogErrorEvent extends BaseEvent {
  message: string
  stackTrace?: string
  fingerprint: string  // hash of error signature for pattern matching
  service?: string
  instanceIp?: string
}

// Incidents
export interface IncidentCreatedEvent extends BaseEvent {
  title: string
  severity: string
  externalRef?: string
  source: string
  evidence?: Record<string, unknown>
}

export interface IncidentResolvedEvent extends BaseEvent {
  incidentId: string
  externalRef?: string
  resolution: string
  durationMs: number
}

// Codebase
export interface CommitPushedEvent extends BaseEvent {
  repo: string
  branch: string
  commitSha: string
  author: string
  message: string
  filesChanged: number
  additions: number
  deletions: number
}

export interface PREvent extends BaseEvent {
  repo: string
  prNumber: number
  title: string
  author: string
  branch: string
  targetBranch: string
  additions?: number
  deletions?: number
}

export interface DeployEvent extends BaseEvent {
  repo: string
  environment: string
  commitSha: string
  instanceIp?: string
  durationMs?: number
  error?: string
}

// Healing
export interface HealingProposedEvent extends BaseEvent {
  healActionId: string
  title: string
  fixType: string
  riskLevel: string
  evidence: Record<string, unknown>
  incidentRef?: string
}

export interface HealingApprovedEvent extends BaseEvent {
  healActionId: string
  approvedBy: string
}

export interface HealingAppliedEvent extends BaseEvent {
  healActionId: string
  success: boolean
  error?: string
}

// Cloud
export interface CloudInstanceEvent extends BaseEvent {
  instanceId: string
  ip?: string
  region: string
  plan: string
  cpuPct?: number
  ramPct?: number
  diskPct?: number
  error?: string
}

// Tokens
export interface TokenBudgetEvent extends BaseEvent {
  budgetId: string
  currentUsd: number
  limitUsd: number
  pct: number
  model?: string
  downgradedTo?: string
}

// Union of all event types
export type ArdouraEvent =
  | AlertTriggeredEvent
  | MetricSpikeEvent
  | LogErrorEvent
  | IncidentCreatedEvent
  | IncidentResolvedEvent
  | CommitPushedEvent
  | PREvent
  | DeployEvent
  | HealingProposedEvent
  | HealingApprovedEvent
  | HealingAppliedEvent
  | CloudInstanceEvent
  | TokenBudgetEvent

export function makeEvent<T extends BaseEvent>(
  topic: TopicName,
  source: string,
  data: Omit<T, 'id' | 'topic' | 'timestamp' | 'source'>
): T {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    topic,
    source,
    timestamp: new Date().toISOString(),
    ...data,
  } as T
}
