// src/middleware/auth.ts
// API key authentication middleware.
// Expects an `x-api-key` header matching a project's API key in the database.
// The /health endpoint is exempt from auth.

import { Request, Response, NextFunction } from 'express';
import pool from '../data/pool';

/**
 * Validates the x-api-key header against the projects table.
 * Attaches `req.projectId` on success so downstream handlers know which project owns the request.
 */
export async function requireApiKey(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const apiKey = req.headers['x-api-key'] as string | undefined;

  if (!apiKey) {
    res
      .status(401)
      .json({ status: 'error', message: 'Missing x-api-key header' });
    return;
  }

  try {
    const result = await pool.query(
      'SELECT id FROM projects WHERE api_key = $1',
      [apiKey],
    );

    if (result.rows.length === 0) {
      res.status(403).json({ status: 'error', message: 'Invalid API key' });
      return;
    }

    // Attach project context for downstream use
    req.projectId = result.rows[0].id;
    next();
  } catch {
    res.status(500).json({ status: 'error', message: 'Auth lookup failed' });
  }
}
