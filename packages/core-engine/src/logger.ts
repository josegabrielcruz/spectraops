// src/logger.ts
// Structured JSON logger built on pino.
// Usage: import logger from './logger';  logger.info({ msg: '...' });

import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport:
    process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
});

export default logger;
