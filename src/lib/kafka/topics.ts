export const TOPICS = {
  // Observability
  OBSERVABILITY_ALERT_TRIGGERED:  'observability.alert.triggered',
  OBSERVABILITY_ALERT_RESOLVED:   'observability.alert.resolved',
  OBSERVABILITY_METRIC_SPIKE:     'observability.metric.spike',
  OBSERVABILITY_LOG_ERROR:        'observability.log.error',

  // Incidents / ITSM
  INCIDENTS_CREATED:              'incidents.created',
  INCIDENTS_UPDATED:              'incidents.updated',
  INCIDENTS_RESOLVED:             'incidents.resolved',
  SERVICENOW_CHANGE_REQUESTED:    'servicenow.change.requested',
  SERVICENOW_CHANGE_APPROVED:     'servicenow.change.approved',
  JIRA_ISSUE_CREATED:             'jira.issue.created',
  JIRA_ISSUE_UPDATED:             'jira.issue.updated',

  // Codebase
  CODE_COMMIT_PUSHED:             'code.commit.pushed',
  CODE_PR_OPENED:                 'code.pr.opened',
  CODE_PR_MERGED:                 'code.pr.merged',
  CODE_DEPLOY_REQUESTED:          'code.deploy.requested',
  CODE_DEPLOY_COMPLETED:          'code.deploy.completed',
  CODE_DEPLOY_FAILED:             'code.deploy.failed',

  // Self-healing
  HEALING_PROPOSED:               'healing.proposed',
  HEALING_APPROVED:               'healing.approved',
  HEALING_REJECTED:               'healing.rejected',
  HEALING_APPLIED:                'healing.applied',
  HEALING_VERIFIED:               'healing.verified',

  // Cloud
  CLOUD_INSTANCE_CREATED:         'cloud.instance.created',
  CLOUD_INSTANCE_DEGRADED:        'cloud.instance.degraded',
  CLOUD_INSTANCE_FAILED:          'cloud.instance.failed',
  CLOUD_COST_THRESHOLD:           'cloud.cost.threshold',

  // Tokens
  TOKENS_BUDGET_WARNING:          'tokens.budget.warning',
  TOKENS_BUDGET_EXCEEDED:         'tokens.budget.exceeded',
  TOKENS_MODEL_DOWNGRADED:        'tokens.model.downgraded',
} as const

export type TopicName = typeof TOPICS[keyof typeof TOPICS]
export const ALL_TOPICS = Object.values(TOPICS)
