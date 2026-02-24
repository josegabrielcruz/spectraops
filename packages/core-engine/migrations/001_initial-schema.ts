// migrations/001_initial-schema.ts
// Initial database schema — creates projects, users, and errors tables.

import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Users (must come before projects due to FK)
  pgm.createTable('users', {
    id: 'id',
    email: { type: 'text', notNull: true, unique: true },
    password_hash: { type: 'text', notNull: true },
    created_at: { type: 'timestamptz', default: pgm.func('NOW()') },
  });

  // Projects
  pgm.createTable('projects', {
    id: 'id',
    name: { type: 'text', notNull: true },
    api_key: {
      type: 'text',
      notNull: true,
      unique: true,
      default: pgm.func('gen_random_uuid()::TEXT'),
    },
    user_id: {
      type: 'integer',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    created_at: { type: 'timestamptz', default: pgm.func('NOW()') },
  });

  pgm.createIndex('projects', 'user_id');

  // Sessions (persistent, DB-backed)
  pgm.createTable('sessions', {
    token: { type: 'text', primaryKey: true },
    user_id: {
      type: 'integer',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    expires_at: { type: 'timestamptz', notNull: true },
    created_at: { type: 'timestamptz', default: pgm.func('NOW()') },
  });

  pgm.createIndex('sessions', 'user_id');
  pgm.createIndex('sessions', 'expires_at');

  // Errors
  pgm.createTable('errors', {
    id: 'id',
    project_id: {
      type: 'integer',
      references: 'projects',
      onDelete: 'CASCADE',
    },
    message: { type: 'text', notNull: true },
    stack: { type: 'text' },
    source_url: { type: 'text' },
    user_agent: { type: 'text' },
    environment: { type: 'text', default: "'production'" },
    severity: {
      type: 'text',
      default: "'error'",
      check: "severity IN ('info', 'warning', 'error', 'fatal')",
    },
    client_timestamp: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', default: pgm.func('NOW()') },
  });

  pgm.createIndex('errors', 'project_id');
  pgm.createIndex('errors', ['created_at'], { method: 'btree' });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('errors');
  pgm.dropTable('sessions');
  pgm.dropTable('projects');
  pgm.dropTable('users');
}
