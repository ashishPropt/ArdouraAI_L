import type { IntegrationType } from '@prisma/client'

export interface MCPToolDef {
  type: IntegrationType
  name: string
  description: string
  actions: Record<string, MCPActionDef>
  configSchema: Record<string, { type: string; required: boolean; secret?: boolean; description: string }>
}

export interface MCPActionDef {
  description: string
  params: Record<string, { type: string; required: boolean; description: string }>
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
  requiresHITL: boolean  // if true → always goes to approval queue
}

export interface MCPToolCall {
  tool: IntegrationType
  action: string
  params: Record<string, unknown>
  integrationId?: string
}

export interface MCPToolResult {
  success: boolean
  data?: unknown
  error?: string
}

export const TOOL_REGISTRY: Record<string, MCPToolDef> = {
  GITHUB: {
    type: 'GITHUB',
    name: 'GitHub',
    description: 'Read/write code, manage PRs, branches, commits on the target application repo',
    configSchema: {
      token:       { type: 'string', required: true,  secret: true,  description: 'Personal Access Token (repo scope)' },
      owner:       { type: 'string', required: true,  secret: false, description: 'GitHub org or username' },
      defaultRepo: { type: 'string', required: false, secret: false, description: 'Default repository name' },
    },
    actions: {
      get_recent_commits:   { description: 'Get last N commits', params: { repo: { type: 'string', required: true, description: 'repo name' }, n: { type: 'number', required: false, description: 'count' } }, riskLevel: 'LOW', requiresHITL: false },
      get_file_content:     { description: 'Read a file from the repo', params: { repo: { type: 'string', required: true, description: 'repo' }, path: { type: 'string', required: true, description: 'file path' }, ref: { type: 'string', required: false, description: 'branch/sha' } }, riskLevel: 'LOW', requiresHITL: false },
      create_pull_request:  { description: 'Open a PR with a fix', params: { repo: { type: 'string', required: true, description: 'repo' }, title: { type: 'string', required: true, description: 'PR title' }, body: { type: 'string', required: true, description: 'PR body' }, head: { type: 'string', required: true, description: 'source branch' }, base: { type: 'string', required: false, description: 'target branch' } }, riskLevel: 'MEDIUM', requiresHITL: true },
      push_file:            { description: 'Push a file change to a branch', params: { repo: { type: 'string', required: true, description: 'repo' }, path: { type: 'string', required: true, description: 'file path' }, content: { type: 'string', required: true, description: 'file content' }, message: { type: 'string', required: true, description: 'commit message' }, branch: { type: 'string', required: true, description: 'branch' } }, riskLevel: 'HIGH', requiresHITL: true },
      list_open_prs:        { description: 'List open PRs', params: { repo: { type: 'string', required: true, description: 'repo' } }, riskLevel: 'LOW', requiresHITL: false },
    },
  },

  JIRA: {
    type: 'JIRA',
    name: 'Jira',
    description: 'Create/update/close issues, manage sprints',
    configSchema: {
      baseUrl:  { type: 'string', required: true,  secret: false, description: 'Jira base URL e.g. https://org.atlassian.net' },
      email:    { type: 'string', required: true,  secret: false, description: 'Atlassian account email' },
      apiToken: { type: 'string', required: true,  secret: true,  description: 'Atlassian API token' },
      project:  { type: 'string', required: true,  secret: false, description: 'Default project key e.g. OPS' },
    },
    actions: {
      create_issue:    { description: 'Create a Jira issue', params: { summary: { type: 'string', required: true, description: 'Issue summary' }, description: { type: 'string', required: false, description: 'Description' }, issuetype: { type: 'string', required: false, description: 'Bug|Task|Incident' }, priority: { type: 'string', required: false, description: 'P1-P4' } }, riskLevel: 'LOW', requiresHITL: false },
      update_issue:    { description: 'Update issue fields', params: { issueKey: { type: 'string', required: true, description: 'e.g. OPS-123' }, status: { type: 'string', required: false, description: 'new status' }, comment: { type: 'string', required: false, description: 'comment to add' } }, riskLevel: 'LOW', requiresHITL: false },
      close_issue:     { description: 'Transition issue to Done', params: { issueKey: { type: 'string', required: true, description: 'e.g. OPS-123' }, resolution: { type: 'string', required: false, description: 'resolution note' } }, riskLevel: 'LOW', requiresHITL: false },
      search_issues:   { description: 'JQL search', params: { jql: { type: 'string', required: true, description: 'JQL query' }, maxResults: { type: 'number', required: false, description: 'max results' } }, riskLevel: 'LOW', requiresHITL: false },
    },
  },

  CONFLUENCE: {
    type: 'CONFLUENCE',
    name: 'Confluence',
    description: 'Create/update runbooks, post-mortems, docs',
    configSchema: {
      baseUrl:  { type: 'string', required: true,  secret: false, description: 'Confluence base URL' },
      email:    { type: 'string', required: true,  secret: false, description: 'Atlassian email' },
      apiToken: { type: 'string', required: true,  secret: true,  description: 'Atlassian API token' },
      spaceKey: { type: 'string', required: true,  secret: false, description: 'Default space key' },
    },
    actions: {
      create_page:   { description: 'Create a Confluence page', params: { title: { type: 'string', required: true, description: 'Page title' }, body: { type: 'string', required: true, description: 'Page content (HTML or wiki)' }, parentId: { type: 'string', required: false, description: 'Parent page ID' } }, riskLevel: 'LOW', requiresHITL: false },
      update_page:   { description: 'Update an existing page', params: { pageId: { type: 'string', required: true, description: 'Page ID' }, title: { type: 'string', required: false, description: 'New title' }, body: { type: 'string', required: true, description: 'New content' } }, riskLevel: 'LOW', requiresHITL: false },
      search_pages:  { description: 'Search Confluence CQL', params: { query: { type: 'string', required: true, description: 'CQL query or text' }, limit: { type: 'number', required: false, description: 'max results' } }, riskLevel: 'LOW', requiresHITL: false },
      get_page:      { description: 'Get page content by ID', params: { pageId: { type: 'string', required: true, description: 'Page ID' } }, riskLevel: 'LOW', requiresHITL: false },
    },
  },

  SERVICENOW: {
    type: 'SERVICENOW',
    name: 'ServiceNow',
    description: 'ITIL incident, change, problem management',
    configSchema: {
      instance:  { type: 'string', required: true,  secret: false, description: 'SN instance e.g. dev12345' },
      username:  { type: 'string', required: true,  secret: false, description: 'Username' },
      password:  { type: 'string', required: true,  secret: true,  description: 'Password or OAuth token' },
    },
    actions: {
      create_incident:   { description: 'Create ITIL incident', params: { short_description: { type: 'string', required: true, description: 'Title' }, description: { type: 'string', required: false, description: 'Details' }, urgency: { type: 'string', required: false, description: '1=High 2=Med 3=Low' }, impact: { type: 'string', required: false, description: '1=High' } }, riskLevel: 'LOW', requiresHITL: false },
      update_incident:   { description: 'Add work notes or change state', params: { sysId: { type: 'string', required: true, description: 'SN sys_id' }, work_notes: { type: 'string', required: false, description: 'Work notes' }, state: { type: 'string', required: false, description: '1=New 2=InProgress 6=Resolved' } }, riskLevel: 'LOW', requiresHITL: false },
      resolve_incident:  { description: 'Resolve an incident', params: { sysId: { type: 'string', required: true, description: 'sys_id' }, resolution: { type: 'string', required: true, description: 'Resolution notes' } }, riskLevel: 'LOW', requiresHITL: false },
      create_change:     { description: 'Raise a change request', params: { short_description: { type: 'string', required: true, description: 'Change title' }, description: { type: 'string', required: false, description: 'Details' }, type: { type: 'string', required: false, description: 'standard|emergency|normal' } }, riskLevel: 'MEDIUM', requiresHITL: true },
    },
  },

  DATADOG: {
    type: 'DATADOG',
    name: 'DataDog',
    description: 'Query metrics, alerts, logs from DataDog',
    configSchema: {
      apiKey:  { type: 'string', required: true, secret: true,  description: 'DataDog API Key' },
      appKey:  { type: 'string', required: true, secret: true,  description: 'DataDog Application Key' },
      site:    { type: 'string', required: false, secret: false, description: 'DataDog site (default: datadoghq.com)' },
    },
    actions: {
      query_metrics:       { description: 'Query timeseries metrics', params: { query: { type: 'string', required: true, description: 'DD metric query' }, from: { type: 'number', required: false, description: 'Unix timestamp from' }, to: { type: 'number', required: false, description: 'Unix timestamp to' } }, riskLevel: 'LOW', requiresHITL: false },
      get_logs:            { description: 'Fetch recent logs', params: { query: { type: 'string', required: true, description: 'Log search query' }, limit: { type: 'number', required: false, description: 'max logs' } }, riskLevel: 'LOW', requiresHITL: false },
      list_active_alerts:  { description: 'List firing monitors', params: {}, riskLevel: 'LOW', requiresHITL: false },
      mute_alert:          { description: 'Mute a monitor', params: { monitorId: { type: 'number', required: true, description: 'Monitor ID' }, durationSecs: { type: 'number', required: false, description: 'Mute duration' } }, riskLevel: 'MEDIUM', requiresHITL: true },
    },
  },

  DYNATRACE: {
    type: 'DYNATRACE',
    name: 'Dynatrace',
    description: 'Query metrics, problems, events from Dynatrace',
    configSchema: {
      baseUrl: { type: 'string', required: true, secret: false, description: 'Dynatrace env URL e.g. https://xxx.live.dynatrace.com' },
      apiToken: { type: 'string', required: true, secret: true, description: 'Dynatrace API token' },
    },
    actions: {
      get_problems:     { description: 'List open problems', params: { status: { type: 'string', required: false, description: 'OPEN|CLOSED' } }, riskLevel: 'LOW', requiresHITL: false },
      get_metrics:      { description: 'Query metric data points', params: { metricSelector: { type: 'string', required: true, description: 'Dynatrace metric selector' }, resolution: { type: 'string', required: false, description: 'e.g. 1m' } }, riskLevel: 'LOW', requiresHITL: false },
      get_events:       { description: 'Fetch recent events', params: { from: { type: 'string', required: false, description: 'relative time e.g. now-1h' } }, riskLevel: 'LOW', requiresHITL: false },
    },
  },

  VULTR: {
    type: 'VULTR',
    name: 'Vultr',
    description: 'Create/manage VPS instances, DNS, billing',
    configSchema: {
      apiKey: { type: 'string', required: true, secret: true, description: 'Vultr API key' },
    },
    actions: {
      list_instances:    { description: 'List all VPS instances', params: {}, riskLevel: 'LOW', requiresHITL: false },
      create_instance:   { description: 'Create a new VPS', params: { label: { type: 'string', required: true, description: 'Instance label' }, plan: { type: 'string', required: false, description: 'e.g. vc2-1c-2gb' }, region: { type: 'string', required: false, description: 'e.g. ewr' } }, riskLevel: 'HIGH', requiresHITL: true },
      resize_instance:   { description: 'Upgrade instance plan', params: { instanceId: { type: 'string', required: true, description: 'Instance ID' }, plan: { type: 'string', required: true, description: 'New plan' } }, riskLevel: 'HIGH', requiresHITL: true },
      reboot_instance:   { description: 'Reboot a VPS', params: { instanceId: { type: 'string', required: true, description: 'Instance ID' } }, riskLevel: 'MEDIUM', requiresHITL: true },
      delete_instance:   { description: 'Destroy a VPS', params: { instanceId: { type: 'string', required: true, description: 'Instance ID' } }, riskLevel: 'HIGH', requiresHITL: true },
      get_metrics:       { description: 'Get instance CPU/RAM/bandwidth', params: { instanceId: { type: 'string', required: true, description: 'Instance ID' } }, riskLevel: 'LOW', requiresHITL: false },
    },
  },

  SLACK: {
    type: 'SLACK',
    name: 'Slack',
    description: 'Send notifications and approval requests to Slack',
    configSchema: {
      webhookUrl:  { type: 'string', required: false, secret: true,  description: 'Incoming webhook URL' },
      botToken:    { type: 'string', required: false, secret: true,  description: 'Bot OAuth token (xoxb-)' },
      channel:     { type: 'string', required: false, secret: false, description: 'Default channel e.g. #incidents' },
    },
    actions: {
      send_message:      { description: 'Post a message', params: { channel: { type: 'string', required: false, description: 'Channel override' }, text: { type: 'string', required: true, description: 'Message text' } }, riskLevel: 'LOW', requiresHITL: false },
      send_alert:        { description: 'Post a formatted incident alert', params: { title: { type: 'string', required: true, description: 'Alert title' }, severity: { type: 'string', required: true, description: 'P1-P4' }, body: { type: 'string', required: true, description: 'Alert body' }, channel: { type: 'string', required: false, description: 'Channel' } }, riskLevel: 'LOW', requiresHITL: false },
      send_hitl_card:    { description: 'Post approval card with Approve/Reject buttons', params: { healActionId: { type: 'string', required: true, description: 'HealAction ID' }, title: { type: 'string', required: true, description: 'Card title' }, description: { type: 'string', required: true, description: 'Proposed fix' }, riskLevel: { type: 'string', required: true, description: 'Risk level' }, channel: { type: 'string', required: false, description: 'Channel' } }, riskLevel: 'LOW', requiresHITL: false },
    },
  },

  DATABASE: {
    type: 'DATABASE',
    name: 'Database',
    description: 'Query, inspect and monitor target app databases',
    configSchema: {
      type:     { type: 'string', required: true,  secret: false, description: 'POSTGRES|MYSQL|MONGODB' },
      host:     { type: 'string', required: true,  secret: false, description: 'DB host' },
      port:     { type: 'number', required: false, secret: false, description: 'DB port' },
      database: { type: 'string', required: true,  secret: false, description: 'Database name' },
      username: { type: 'string', required: true,  secret: false, description: 'Username' },
      password: { type: 'string', required: true,  secret: true,  description: 'Password' },
    },
    actions: {
      run_query:         { description: 'Execute a SELECT query', params: { sql: { type: 'string', required: true, description: 'SQL query (SELECT only)' } }, riskLevel: 'LOW', requiresHITL: false },
      get_slow_queries:  { description: 'Get slow query log', params: { limitMs: { type: 'number', required: false, description: 'Threshold in ms' }, limit: { type: 'number', required: false, description: 'Max results' } }, riskLevel: 'LOW', requiresHITL: false },
      get_table_sizes:   { description: 'Get table row counts and sizes', params: {}, riskLevel: 'LOW', requiresHITL: false },
      check_connections: { description: 'Check active connection count vs max', params: {}, riskLevel: 'LOW', requiresHITL: false },
      explain_query:     { description: 'EXPLAIN ANALYZE a query', params: { sql: { type: 'string', required: true, description: 'Query to explain' } }, riskLevel: 'LOW', requiresHITL: false },
    },
  },
}
