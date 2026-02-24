// src/api/project.ts
// Project + API key management endpoints.
// All routes require session authentication (dashboard user).

import express, { Router, Request, Response } from 'express';
import { z } from 'zod';
import pool from '../data/pool';

/** Strip HTML/script tags as defense-in-depth against stored XSS */
function stripTags(input: string): string {
  return input.replace(/<\/?[^>]+(>|$)/g, '');
}

const router: Router = express.Router();

const createProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(100),
});

// GET /api/projects — list projects for the authenticated user
router.get('/', async (req: Request, res: Response) => {
  const userId = req.userId!;
  try {
    const result = await pool.query(
      `SELECT id, name, api_key, created_at FROM projects WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId],
    );
    res.json({ status: 'ok', data: result.rows });
  } catch (err) {
    req.log?.error({ err }, 'Failed to fetch projects');
    res
      .status(500)
      .json({ status: 'error', message: 'Failed to fetch projects' });
  }
});

// POST /api/projects — create a new project (auto-generates API key)
router.post('/', async (req: Request, res: Response) => {
  const userId = req.userId!;

  const parsed = createProjectSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ status: 'error', message: parsed.error.issues });
    return;
  }

  const sanitisedName = stripTags(parsed.data.name.trim()).slice(0, 100);

  try {
    const result = await pool.query(
      `INSERT INTO projects (name, user_id) VALUES ($1, $2) RETURNING id, name, api_key, created_at`,
      [sanitisedName, userId],
    );
    req.log?.info({ project: result.rows[0].name }, 'Project created');
    res.status(201).json({ status: 'ok', data: result.rows[0] });
  } catch (err) {
    req.log?.error({ err }, 'Failed to create project');
    res
      .status(500)
      .json({ status: 'error', message: 'Failed to create project' });
  }
});

// DELETE /api/projects/:id — delete a project (cascades to errors)
router.delete('/:id', async (req: Request, res: Response) => {
  const userId = req.userId!;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ status: 'error', message: 'Invalid project ID' });
    return;
  }

  try {
    const result = await pool.query(
      `DELETE FROM projects WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, userId],
    );

    if (result.rows.length === 0) {
      res.status(404).json({ status: 'error', message: 'Project not found' });
      return;
    }

    req.log?.info({ projectId: id }, 'Project deleted');
    res.json({ status: 'ok' });
  } catch (err) {
    req.log?.error({ err }, 'Failed to delete project');
    res
      .status(500)
      .json({ status: 'error', message: 'Failed to delete project' });
  }
});

// POST /api/projects/:id/rotate-key — regenerate the API key
router.post('/:id/rotate-key', async (req: Request, res: Response) => {
  const userId = req.userId!;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ status: 'error', message: 'Invalid project ID' });
    return;
  }

  try {
    const result = await pool.query(
      `UPDATE projects SET api_key = gen_random_uuid()::TEXT WHERE id = $1 AND user_id = $2 RETURNING id, name, api_key`,
      [id, userId],
    );

    if (result.rows.length === 0) {
      res.status(404).json({ status: 'error', message: 'Project not found' });
      return;
    }

    req.log?.info({ projectId: id }, 'API key rotated');
    res.json({ status: 'ok', data: result.rows[0] });
  } catch (err) {
    req.log?.error({ err }, 'Failed to rotate API key');
    res
      .status(500)
      .json({ status: 'error', message: 'Failed to rotate API key' });
  }
});

export default router;
