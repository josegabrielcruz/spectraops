// src/api/error.ts
import express, { Router } from 'express';
import { z } from 'zod';
import { storeError, storeErrorBatch, fetchAllErrors } from '../data/errors';

const router: Router = express.Router();

/** Strip HTML/script tags as defense-in-depth against stored XSS */
function stripTags(input: string): string {
  return input.replace(/<\/?[^>]+(>|$)/g, '');
}

const errorSchema = z.object({
  message: z.string().min(1, 'message is required'),
  stack: z.string().optional(),
  source_url: z.string().optional(),
  user_agent: z.string().optional(),
  environment: z.enum(['development', 'staging', 'production']).optional(),
  severity: z.enum(['info', 'warning', 'error', 'fatal']).optional(),
  timestamp: z.string().datetime({ offset: true }).optional(),
});

const batchSchema = z.object({
  errors: z.array(errorSchema).min(1).max(100),
});

// POST /api/errors - Ingest error events (SDK only — requires API key)
router.post('/', async (req, res) => {
  try {
    const parsed = errorSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ status: 'error', message: parsed.error.issues });
      return;
    }

    const projectId = req.projectId;
    if (!projectId) {
      res
        .status(403)
        .json({ status: 'error', message: 'Project context required' });
      return;
    }

    // Sanitise user-supplied text fields
    const sanitised = {
      ...parsed.data,
      message: stripTags(parsed.data.message),
      stack: parsed.data.stack ? stripTags(parsed.data.stack) : undefined,
    };

    await storeError({ ...sanitised, project_id: projectId });
    res.status(201).json({ status: 'ok' });
  } catch (e) {
    res.status(500).json({ status: 'error', message: 'Failed to store error' });
  }
});

// POST /api/errors/batch - Batch ingest (SDK sends all queued errors in one request)
router.post('/batch', async (req, res) => {
  try {
    const parsed = batchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ status: 'error', message: parsed.error.issues });
      return;
    }

    const projectId = req.projectId;
    if (!projectId) {
      res
        .status(403)
        .json({ status: 'error', message: 'Project context required' });
      return;
    }

    const sanitised = parsed.data.errors.map((e) => ({
      ...e,
      message: stripTags(e.message),
      stack: e.stack ? stripTags(e.stack) : undefined,
      project_id: projectId,
    }));

    await storeErrorBatch(sanitised);
    res.status(201).json({ status: 'ok', accepted: sanitised.length });
  } catch (e) {
    res
      .status(500)
      .json({ status: 'error', message: 'Failed to store errors' });
  }
});

// GET /api/errors - Fetch errors (paginated, scoped to user's projects)
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit as string) || 50),
    );
    const offset = (page - 1) * limit;

    // If accessed via API key, scope to that project
    const projectId = req.projectId;
    // If accessed via session, scope to all of user's projects
    const userId = req.userId;

    const { rows, total } = await fetchAllErrors({
      limit,
      offset,
      projectId,
      userId,
    });
    res.json({
      data: rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (e) {
    res
      .status(500)
      .json({ status: 'error', message: 'Failed to fetch errors' });
  }
});

export default router;
