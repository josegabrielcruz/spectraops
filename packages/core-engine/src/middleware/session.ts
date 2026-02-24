// src/middleware/session.ts
// Session authentication middleware for dashboard-protected routes.
// Validates the Bearer token from the Authorization header against
// the sessions table. Attaches req.userId and req.userEmail on success.

import { Request, Response, NextFunction } from 'express';
import pool from '../data/pool';

export async function requireSession(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    res
      .status(401)
      .json({ status: 'error', message: 'Authentication required' });
    return;
  }

  try {
    const result = await pool.query(
      `SELECT s.user_id, u.email
       FROM sessions s JOIN users u ON s.user_id = u.id
       WHERE s.token = $1 AND s.expires_at > NOW()`,
      [token],
    );

    if (result.rows.length === 0) {
      res
        .status(401)
        .json({ status: 'error', message: 'Session expired or invalid' });
      return;
    }

    req.userId = result.rows[0].user_id;
    req.userEmail = result.rows[0].email;
    next();
  } catch {
    res
      .status(500)
      .json({ status: 'error', message: 'Session validation failed' });
  }
}
