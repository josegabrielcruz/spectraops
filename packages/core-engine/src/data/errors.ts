// src/data/errors.ts
import pool from './pool';

export async function storeError(error: { message: string; stack?: string }) {
  const { message, stack } = error;
  await pool.query('INSERT INTO errors (message, stack) VALUES ($1, $2)', [
    message,
    stack || null,
  ]);
  return true;
}

export async function fetchAllErrors() {
  const result = await pool.query(
    'SELECT id, message, stack, created_at FROM errors ORDER BY created_at DESC LIMIT 100',
  );
  return result.rows;
}
