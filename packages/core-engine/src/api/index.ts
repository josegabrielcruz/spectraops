// API Gateway
import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from 'express';
import cors from 'cors';
import helmet from 'helmet';
import crypto from 'crypto';
import pool from '../data/pool';
import logger from '../logger';
import { requireApiKey } from '../middleware/auth';
import { requireSession } from '../middleware/session';
import { rateLimit } from '../middleware/rate-limit';
import errorRouter from './error';
import authRouter from './auth';
import projectRouter from './project';

const app: Express = express();

// ── Trust proxy (required behind nginx / cloud LB / Docker) ─────
if (process.env.TRUST_PROXY) {
  app.set(
    'trust proxy',
    process.env.TRUST_PROXY === 'true' ? true : process.env.TRUST_PROXY,
  );
}

// ── Security headers ────────────────────────────────────────────
app.use(helmet());

// ── CORS — restrict origins in production ───────────────────────
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',')
  : ['http://localhost:5173'];

app.use(
  cors({
    origin: (origin, cb) => {
      // Allow requests with no origin (curl, server-to-server)
      if (!origin || allowedOrigins.includes(origin)) {
        cb(null, true);
      } else {
        cb(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-api-key',
      'x-request-id',
    ],
    exposedHeaders: [
      'X-Request-Id',
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
    ],
  }),
);

// ── Body parsing with size limit ────────────────────────────────
app.use(express.json({ limit: '256kb' }));

// ── Rate limiting (global) ──────────────────────────────────────
app.use(
  rateLimit({
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000,
    max: Number(process.env.RATE_LIMIT_MAX) || 100,
  }),
);

// ── Request ID propagation ──────────────────────────────────────
app.use((req: Request, res: Response, next: NextFunction) => {
  const requestId =
    (req.headers['x-request-id'] as string) || crypto.randomUUID();
  res.setHeader('X-Request-Id', requestId);
  // Attach to logger child for correlation
  req.log = logger.child({ requestId });
  req.log.info({ method: req.method, url: req.url }, 'incoming request');
  next();
});

// ── Public routes ───────────────────────────────────────────────
// Health check — verifies the API is up and the database is reachable
app.get('/health', async (_req: Request, res: Response) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'ok',
      service: 'SpectraOps Core Engine API',
      db: 'connected',
    });
  } catch {
    res.status(503).json({
      status: 'degraded',
      service: 'SpectraOps Core Engine API',
      db: 'unreachable',
    });
  }
});

// Dashboard authentication (public — no API key needed)
app.use('/api/auth', authRouter);

// Dashboard routes (session-protected)
app.use('/api/projects', requireSession, projectRouter);

// ── Error routes ────────────────────────────────────────────────
// SDK ingestion uses x-api-key; dashboard viewing uses session auth.
// Both middleware attach project context for scoping.
app.use(
  '/api/errors',
  (req: Request, res: Response, next: NextFunction) => {
    // If the request has a session token, use session auth (dashboard)
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return requireSession(req, res, next);
    }
    // Otherwise fall back to API key auth (SDK)
    return requireApiKey(req, res, next);
  },
  errorRouter,
);

// ── Global error handler ────────────────────────────────────────
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ status: 'error', message: 'Internal server error' });
});

export default app;
