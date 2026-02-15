-- SpectraOps initial Postgres schema (placeholder)
-- TODO: Expand with tables for users, projects, errors, sessions, tests, etc.

CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add errors table
CREATE TABLE IF NOT EXISTS errors (
  id SERIAL PRIMARY KEY,
  message TEXT NOT NULL,
  stack TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
