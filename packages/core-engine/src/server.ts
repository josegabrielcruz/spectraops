import app from './api/index';
import pool from './data/pool';
import logger from './logger';

const PORT = process.env.PORT || 3000;

// ── Crash handlers ────────────────────────────────────────────────
process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'Unhandled promise rejection');
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception');
  process.exit(1);
});

// ── DB pool error handler ─────────────────────────────────────────
pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected PostgreSQL pool error');
});

const server = app.listen(PORT, () => {
  logger.info({ port: PORT }, 'SpectraOps Core Engine API listening');
});

// ── Request timeout (30s) ─────────────────────────────────────────
server.setTimeout(30_000);

// ── Periodic session cleanup (every 15 min) ───────────────────────
const SESSION_CLEANUP_INTERVAL = 15 * 60 * 1000;
const cleanupTimer = setInterval(async () => {
  try {
    const result = await pool.query(
      'DELETE FROM sessions WHERE expires_at <= NOW()',
    );
    if (result.rowCount && result.rowCount > 0) {
      logger.info({ pruned: result.rowCount }, 'Expired sessions cleaned up');
    }
  } catch (err) {
    logger.error({ err }, 'Session cleanup failed');
  }
}, SESSION_CLEANUP_INTERVAL);
cleanupTimer.unref();

// ── Periodic error data retention (every 1 hour, keep 90 days) ────
const ERROR_RETENTION_DAYS = Number(process.env.ERROR_RETENTION_DAYS) || 90;
const ERROR_CLEANUP_INTERVAL = 60 * 60 * 1000;
const errorCleanupTimer = setInterval(async () => {
  try {
    const result = await pool.query(
      `DELETE FROM errors WHERE created_at < NOW() - INTERVAL '1 day' * $1`,
      [ERROR_RETENTION_DAYS],
    );
    if (result.rowCount && result.rowCount > 0) {
      logger.info(
        { pruned: result.rowCount, retentionDays: ERROR_RETENTION_DAYS },
        'Old errors cleaned up',
      );
    }
  } catch (err) {
    logger.error({ err }, 'Error retention cleanup failed');
  }
}, ERROR_CLEANUP_INTERVAL);
errorCleanupTimer.unref();

// ── Graceful shutdown ─────────────────────────────────────────────
function shutdown(signal: string) {
  logger.info({ signal }, 'Shutdown signal received, draining connections…');

  server.close(async () => {
    try {
      await pool.end();
      logger.info('Database pool closed');
    } catch (err) {
      logger.error({ err }, 'Error closing database pool');
    }
    process.exit(0);
  });

  // Force exit after 10 s if connections don't drain
  setTimeout(() => {
    logger.warn('Forcing exit after shutdown timeout');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
