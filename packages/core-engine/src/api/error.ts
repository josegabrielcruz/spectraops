// src/api/error.ts
import express, { Router } from 'express';
import { z } from 'zod';
import { storeError, fetchAllErrors } from '../data/errors';

const router: Router = express.Router();

const errorSchema = z.object({
  message: z.string().min(1, 'message is required'),
  stack: z.string().optional(),
});

// POST /api/errors - Ingest error events
router.post('/', async (req, res) => {
  try {
    const parsed = errorSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ status: 'error', message: parsed.error.issues });
      return;
    }
    await storeError(parsed.data);
    res.status(201).json({ status: 'ok' });
  } catch (e) {
    res.status(500).json({ status: 'error', message: 'Failed to store error' });
  }
});

// GET /api/errors - Fetch errors
router.get('/', async (_req, res) => {
  try {
    const errors = await fetchAllErrors();
    res.json(errors);
  } catch (e) {
    res
      .status(500)
      .json({ status: 'error', message: 'Failed to fetch errors' });
  }
});

export default router;
