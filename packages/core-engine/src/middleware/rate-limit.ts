// src/middleware/rate-limit.ts
// Simple in-memory sliding-window rate limiter.
//
// ⚠️  KNOWN LIMITATION (MVP):
// This rate limiter stores counters in process memory. It resets when the
// server restarts and does NOT share state across multiple instances.
// For horizontal scaling, replace with a Redis-backed solution
// (e.g., `rate-limit-redis` + `express-rate-limit`).
//
// For a single-process deployment this is production-ready.

import { Request, Response, NextFunction } from 'express';

interface RateLimitOptions {
  /** Time window in milliseconds (default: 60 000 = 1 min) */
  windowMs?: number;
  /** Max requests per window per IP (default: 100) */
  max?: number;
}

interface ClientRecord {
  count: number;
  resetAt: number;
}

const clients = new Map<string, ClientRecord>();

export function rateLimit(opts: RateLimitOptions = {}) {
  const windowMs = opts.windowMs ?? 60_000;
  const max = opts.max ?? 100;

  // Periodically clean up stale entries (every 5 min)
  setInterval(() => {
    const now = Date.now();
    for (const [key, rec] of clients) {
      if (rec.resetAt <= now) clients.delete(key);
    }
  }, 5 * 60_000).unref();

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const now = Date.now();
    let record = clients.get(key);

    if (!record || record.resetAt <= now) {
      record = { count: 0, resetAt: now + windowMs };
      clients.set(key, record);
    }

    record.count++;

    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader(
      'X-RateLimit-Remaining',
      String(Math.max(0, max - record.count)),
    );
    res.setHeader(
      'X-RateLimit-Reset',
      String(Math.ceil(record.resetAt / 1000)),
    );

    if (record.count > max) {
      res.status(429).json({ status: 'error', message: 'Too many requests' });
      return;
    }

    next();
  };
}
