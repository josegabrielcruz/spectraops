// src/data/errors.ts
import pool from './pool';

export interface ErrorInput {
  message: string;
  stack?: string;
  source_url?: string;
  user_agent?: string;
  environment?: string;
  severity?: string;
  project_id?: number;
  timestamp?: string;
}

export async function storeError(error: ErrorInput) {
  const {
    message,
    stack,
    source_url,
    user_agent,
    environment,
    severity,
    project_id,
    timestamp,
  } = error;
  await pool.query(
    `INSERT INTO errors (project_id, message, stack, source_url, user_agent, environment, severity, client_timestamp)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      project_id || null,
      message,
      stack || null,
      source_url || null,
      user_agent || null,
      environment || 'production',
      severity || 'error',
      timestamp || null,
    ],
  );
  return true;
}

/**
 * Store multiple errors in a single database transaction.
 * All-or-nothing: if any INSERT fails the entire batch is rolled back.
 */
export async function storeErrorBatch(errors: ErrorInput[]) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const error of errors) {
      const {
        message,
        stack,
        source_url,
        user_agent,
        environment,
        severity,
        project_id,
        timestamp,
      } = error;
      await client.query(
        `INSERT INTO errors (project_id, message, stack, source_url, user_agent, environment, severity, client_timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          project_id || null,
          message,
          stack || null,
          source_url || null,
          user_agent || null,
          environment || 'production',
          severity || 'error',
          timestamp || null,
        ],
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  return true;
}

export async function fetchAllErrors(
  opts: {
    limit?: number;
    offset?: number;
    projectId?: number;
    userId?: number;
  } = {},
) {
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;

  // Build WHERE clause based on scoping
  let whereClause = '';
  const params: unknown[] = [];
  let paramIdx = 1;

  if (opts.projectId) {
    whereClause = `WHERE e.project_id = $${paramIdx++}`;
    params.push(opts.projectId);
  } else if (opts.userId) {
    whereClause = `WHERE e.project_id IN (SELECT id FROM projects WHERE user_id = $${paramIdx++})`;
    params.push(opts.userId);
  }

  const [dataResult, countResult] = await Promise.all([
    pool.query(
      `SELECT e.id, e.project_id, e.message, e.stack, e.source_url, e.user_agent, e.environment, e.severity, e.client_timestamp, e.created_at
       FROM errors e ${whereClause} ORDER BY e.created_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      [...params, limit, offset],
    ),
    pool.query(
      `SELECT COUNT(*)::int AS total FROM errors e ${whereClause}`,
      params,
    ),
  ]);

  return {
    rows: dataResult.rows,
    total: countResult.rows[0].total as number,
  };
}
