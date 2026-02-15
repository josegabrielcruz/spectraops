// src/api/error.ts
import express from 'express';
import { storeError } from '../data/errors';

const router = express.Router();

// POST /api/errors - Ingest error events

// POST /api/errors - Ingest error events
router.post('/', async (req, res) => {
  try {
    await storeError(req.body);
    res.status(201).json({ status: 'ok' });
  } catch (e) {
    res.status(500).json({ status: 'error', message: 'Failed to store error' });
  }
});

// GET /api/errors - Fetch errors
router.get('/', async (_req, res) => {
  try {
    const errors = await import('../data/errors').then((m) =>
      m.fetchAllErrors(),
    );
    res.json(errors);
  } catch (e) {
    res
      .status(500)
      .json({ status: 'error', message: 'Failed to fetch errors' });
  }
});

export default router;
