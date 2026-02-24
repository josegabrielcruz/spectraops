// src/api/auth.ts
// Dashboard authentication with bcrypt password hashing and DB-backed sessions.

import express, { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import pool from '../data/pool';

const router: Router = express.Router();

const SALT_ROUNDS = 12;
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const loginSchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const registerSchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one digit'),
});

// ── Helper: create a DB-backed session ──────────────────────────
async function createSession(
  userId: number,
): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await pool.query(
    'INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)',
    [token, userId, expiresAt],
  );

  return { token, expiresAt };
}

// ── Helper: look up a valid session ─────────────────────────────
async function getSession(token: string) {
  const result = await pool.query(
    `SELECT s.token, s.user_id, s.expires_at, u.email
     FROM sessions s JOIN users u ON s.user_id = u.id
     WHERE s.token = $1 AND s.expires_at > NOW()`,
    [token],
  );
  return result.rows[0] ?? null;
}

// POST /api/auth/register — create a new dashboard user
router.post('/register', async (req, res) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ status: 'error', message: parsed.error.issues });
      return;
    }

    const { email, password } = parsed.data;

    // Check for duplicate
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [
      email,
    ]);
    if (existing.rows.length > 0) {
      res.status(409).json({ status: 'error', message: 'User already exists' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const result = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [email, passwordHash],
    );

    const user = result.rows[0];
    const { token } = await createSession(user.id);

    req.log?.info({ email }, 'User registered');
    res
      .status(201)
      .json({ status: 'ok', token, user: { id: user.id, email: user.email } });
  } catch (err) {
    req.log?.error({ err }, 'Registration failed');
    res.status(500).json({ status: 'error', message: 'Registration failed' });
  }
});

// POST /api/auth/login — authenticate dashboard users
router.post('/login', async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ status: 'error', message: parsed.error.issues });
      return;
    }

    const { email, password } = parsed.data;

    // Look up user with password hash
    const result = await pool.query(
      'SELECT id, email, password_hash FROM users WHERE email = $1',
      [email],
    );
    if (result.rows.length === 0) {
      res.status(401).json({ status: 'error', message: 'Invalid credentials' });
      return;
    }

    const user = result.rows[0];

    // Verify password
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ status: 'error', message: 'Invalid credentials' });
      return;
    }

    const { token } = await createSession(user.id);

    req.log?.info({ email }, 'User logged in');
    res.json({ status: 'ok', token, user: { id: user.id, email: user.email } });
  } catch (err) {
    req.log?.error({ err }, 'Login failed');
    res.status(500).json({ status: 'error', message: 'Login failed' });
  }
});

// POST /api/auth/logout
router.post('/logout', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    await pool
      .query('DELETE FROM sessions WHERE token = $1', [token])
      .catch(() => {});
  }
  res.json({ status: 'ok' });
});

// GET /api/auth/me — validate session
router.get('/me', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    res.status(401).json({ status: 'error', message: 'Not authenticated' });
    return;
  }

  try {
    const session = await getSession(token);
    if (!session) {
      res.status(401).json({ status: 'error', message: 'Session expired' });
      return;
    }

    res.json({
      status: 'ok',
      user: { id: session.user_id, email: session.email },
    });
  } catch {
    res.status(500).json({ status: 'error', message: 'Session lookup failed' });
  }
});

export default router;
