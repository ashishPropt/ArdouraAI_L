export type ConditionOperator =
  | 'eq' | 'neq'
  | 'gt' | 'gte' | 'lt' | 'lte'
  | 'contains' | 'not_contains'
  | 'starts_with' | 'ends_with'
  | 'in' | 'not_in'
  | 'exists' | 'not_exists'
  | 'matches_regex'

export interface RuleCondition {
  field: string          // dot-path into the event, e.g. "severity" or "value"
  operator: ConditionOperator
  value?: unknown        // not needed for exists/not_exists
}

export interface RuleAction {
  tool: string           // IntegrationType key e.g. "JIRA"
  action: string         // action name e.g. "create_issue"
  params: Record<string, unknown>  // may use {{event.field}} templates
  integrationId?: string // if blank, uses first matching integration
}

export interface RuleDefinition {
  id: string
  name: string
  description?: string
  enabled: boolean
  topic: string          // Kafka topic this rule listens on
  // "AND" of all conditions (all must pass)
  conditions: RuleCondition[]
  actions: RuleAction[]
  cooldownMs?: number    // don't re-fire within this window (default 5min)
}
