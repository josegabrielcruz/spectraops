import type { Logger } from 'pino';

declare global {
  namespace Express {
    interface Request {
      /** Project ID attached by API key middleware */
      projectId?: number;
      /** User ID attached by session middleware */
      userId?: number;
      /** User email attached by session middleware */
      userEmail?: string;
      /** Pino child logger with request ID */
      log?: Logger;
    }
  }
}
