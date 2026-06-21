import type { MCPToolResult } from '../registry'

interface DBConfig {
  type: 'POSTGRES' | 'MYSQL' | 'MONGODB'
  host: string
  port?: number
  database: string
  username: string
  password: string
}

// Only SELECT-class queries are allowed through the read-only path
function assertReadOnly(sql: string) {
  const normalized = sql.trim().toUpperCase()
  const dangerous = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'TRUNCATE', 'ALTER', 'CREATE', 'REPLACE', 'EXEC', 'CALL']
  for (const kw of dangerous) {
    if (normalized.startsWith(kw)) throw new Error(`Write query "${kw}" blocked — use run_query for SELECT only`)
  }
}

async function runPostgres(sql: string, cfg: DBConfig): Promise<unknown[]> {
  const { Client } = await import('pg')
  const client = new Client({
    host: cfg.host, port: cfg.port ?? 5432,
    database: cfg.database, user: cfg.username, password: cfg.password,
    connectionTimeoutMillis: 5000,
  })
  await client.connect()
  try {
    const res = await client.query(sql)
    return res.rows
  } finally {
    await client.end()
  }
}

async function runMysql(sql: string, cfg: DBConfig): Promise<unknown[]> {
  const mysql = await import('mysql2/promise')
  const conn = await mysql.createConnection({
    host: cfg.host, port: cfg.port ?? 3306,
    database: cfg.database, user: cfg.username, password: cfg.password,
    connectTimeout: 5000,
  })
  try {
    const [rows] = await conn.execute(sql)
    return rows as unknown[]
  } finally {
    await conn.end()
  }
}

export async function databaseTool(
  action: string,
  params: Record<string, unknown>,
  config: Record<string, unknown>
): Promise<MCPToolResult> {
  const cfg = config as DBConfig

  if (cfg.type === 'MONGODB') {
    return { success: false, error: 'MongoDB read-only introspection not yet implemented' }
  }

  const isPostgres = cfg.type === 'POSTGRES'
  const run = isPostgres ? runPostgres : runMysql

  switch (action) {
    case 'run_query': {
      const sql = params.sql as string
      assertReadOnly(sql)
      const rows = await run(sql, cfg)
      return { success: true, data: { rows, count: (rows as unknown[]).length } }
    }

    case 'get_slow_queries': {
      const limitMs = (params.limitMs as number) ?? 1000
      const limit = (params.limit as number) ?? 20
      let sql: string
      if (isPostgres) {
        sql = `SELECT query, calls, mean_exec_time, total_exec_time, rows FROM pg_stat_statements WHERE mean_exec_time > ${limitMs} ORDER BY mean_exec_time DESC LIMIT ${limit}`
      } else {
        sql = `SELECT * FROM information_schema.processlist WHERE TIME > ${limitMs / 1000} ORDER BY TIME DESC LIMIT ${limit}`
      }
      try {
        const rows = await run(sql, cfg)
        return { success: true, data: rows }
      } catch (e: any) {
        if (e.message?.includes('pg_stat_statements')) {
          return { success: false, error: 'pg_stat_statements extension not installed. Run: CREATE EXTENSION pg_stat_statements' }
        }
        throw e
      }
    }

    case 'get_table_sizes': {
      let sql: string
      if (isPostgres) {
        sql = `SELECT relname AS table, n_live_tup AS row_estimate, pg_size_pretty(pg_total_relation_size(relid)) AS total_size FROM pg_stat_user_tables ORDER BY pg_total_relation_size(relid) DESC LIMIT 20`
      } else {
        sql = `SELECT table_name, table_rows, ROUND((data_length + index_length) / 1024 / 1024, 2) AS size_mb FROM information_schema.tables WHERE table_schema = DATABASE() ORDER BY (data_length + index_length) DESC LIMIT 20`
      }
      const rows = await run(sql, cfg)
      return { success: true, data: rows }
    }

    case 'check_connections': {
      let sql: string
      if (isPostgres) {
        sql = `SELECT count(*) as active, (SELECT setting::int FROM pg_settings WHERE name='max_connections') as max_connections FROM pg_stat_activity WHERE state = 'active'`
      } else {
        sql = `SELECT count(*) as active, @@max_connections as max_connections FROM information_schema.processlist`
      }
      const rows = await run(sql, cfg)
      return { success: true, data: rows[0] }
    }

    case 'explain_query': {
      const sql = `EXPLAIN ANALYZE ${params.sql}`
      const rows = await run(sql, cfg)
      return { success: true, data: rows }
    }

    default:
      return { success: false, error: `Unknown Database action: ${action}` }
  }
}
