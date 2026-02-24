// Database connection using pg
import { Pool } from 'pg';

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgres://postgres:postgres@localhost:5432/spectraops',
  max: Number(process.env.PG_POOL_MAX) || 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

export default pool;
