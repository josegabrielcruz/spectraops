import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/api/index';

// Mock the data layer so tests don't need a real database
vi.mock('../src/data/errors', () => ({
  storeError: vi.fn().mockResolvedValue(true),
  storeErrorBatch: vi.fn().mockResolvedValue(true),
  fetchAllErrors: vi.fn().mockResolvedValue({
    rows: [
      {
        id: 1,
        message: 'Test error',
        stack: 'Error: Test\n    at main (index.js:1:1)',
        created_at: '2026-01-01T00:00:00.000Z',
      },
    ],
    total: 1,
  }),
}));

// bcryptjs mock – returns predictable values so we can test auth flows
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('$2b$12$hashedpassword'),
    compare: vi.fn().mockImplementation(async (plain: string) => {
      return plain === 'ValidPass1';
    }),
  },
}));

vi.mock('../src/data/pool', () => ({
  default: {
    query: vi
      .fn()
      .mockImplementation(async (sql: string, params?: unknown[]) => {
        // Auth middleware: project lookup by API key
        if (sql.includes('SELECT id FROM projects WHERE api_key')) {
          return { rows: [{ id: 1 }] };
        }
        // Project CRUD: list projects (now user-scoped)
        if (
          sql.includes('SELECT id, name, api_key, created_at FROM projects')
        ) {
          return {
            rows: [
              {
                id: 1,
                name: 'test-project',
                api_key: 'key-abc-123',
                created_at: '2026-01-01T00:00:00.000Z',
              },
            ],
          };
        }
        // Project CRUD: create project (now includes user_id)
        if (sql.includes('INSERT INTO projects')) {
          return {
            rows: [
              {
                id: 2,
                name: params?.[0],
                api_key: 'new-key-456',
                created_at: new Date().toISOString(),
              },
            ],
          };
        }
        // Project CRUD: delete project (now user-scoped)
        if (sql.includes('DELETE FROM projects')) {
          const id = params?.[0];
          if (id === 999) return { rows: [] };
          return { rows: [{ id }] };
        }
        // Project CRUD: rotate key (now user-scoped)
        if (sql.includes('UPDATE projects SET api_key')) {
          const id = params?.[0];
          if (id === 999) return { rows: [] };
          return {
            rows: [
              {
                id,
                name: 'test-project',
                api_key: 'rotated-key-789',
              },
            ],
          };
        }
        // Register: duplicate check
        if (sql.includes('SELECT id FROM users WHERE email')) {
          const email = params?.[0];
          if (email === 'existing@test.com') {
            return { rows: [{ id: 99 }] };
          }
          return { rows: [] };
        }
        // Register: insert user
        if (sql.includes('INSERT INTO users')) {
          return { rows: [{ id: 42, email: params?.[0] }] };
        }
        // Login: lookup user with password
        if (sql.includes('SELECT id, email, password_hash FROM users')) {
          const email = params?.[0];
          if (email === 'test@test.com') {
            return {
              rows: [
                {
                  id: 42,
                  email: 'test@test.com',
                  password_hash: '$2b$12$hashedpassword',
                },
              ],
            };
          }
          return { rows: [] };
        }
        // Insert session
        if (sql.includes('INSERT INTO sessions')) {
          return { rows: [] };
        }
        // Get session (me endpoint + session middleware) – join sessions + users
        if (sql.includes('FROM sessions')) {
          if (sql.includes('DELETE')) {
            return { rows: [] };
          }
          const token = params?.[0];
          if (token === 'valid-session-token') {
            return {
              rows: [
                {
                  token: 'valid-session-token',
                  user_id: 42,
                  email: 'test@test.com',
                  expires_at: new Date(Date.now() + 86400000),
                },
              ],
            };
          }
          return { rows: [] };
        }
        // Health check
        return { rows: [{ '?column?': 1 }] };
      }),
    end: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
  },
}));

// Suppress pino logs during tests
vi.mock('../src/logger', () => {
  const noopLogger: Record<string, any> = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
  };
  noopLogger.child = vi.fn().mockReturnValue(noopLogger);
  return { default: noopLogger };
});

const VALID_API_KEY = 'test-api-key-123';

describe('core-engine API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /health', () => {
    it('returns status ok (no auth required)', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        status: 'ok',
        service: 'SpectraOps Core Engine API',
        db: 'connected',
      });
    });
  });

  describe('POST /api/errors', () => {
    it('rejects requests without an API key', async () => {
      const res = await request(app)
        .post('/api/errors')
        .send({ message: 'No key' });

      expect(res.status).toBe(401);
      expect(res.body.message).toContain('Missing');
    });

    it('accepts a valid error payload with API key', async () => {
      const res = await request(app)
        .post('/api/errors')
        .set('x-api-key', VALID_API_KEY)
        .send({ message: 'Something broke', stack: 'Error: Something broke' });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({ status: 'ok' });
    });

    it('rejects a payload without a message', async () => {
      const res = await request(app)
        .post('/api/errors')
        .set('x-api-key', VALID_API_KEY)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
    });

    it('rejects an empty message string', async () => {
      const res = await request(app)
        .post('/api/errors')
        .set('x-api-key', VALID_API_KEY)
        .send({ message: '' });

      expect(res.status).toBe(400);
    });

    it('accepts a payload with only a message (no stack)', async () => {
      const res = await request(app)
        .post('/api/errors')
        .set('x-api-key', VALID_API_KEY)
        .send({ message: 'Minimal error' });

      expect(res.status).toBe(201);
    });
  });

  describe('POST /api/errors/batch', () => {
    it('rejects requests without an API key', async () => {
      const res = await request(app)
        .post('/api/errors/batch')
        .send({ errors: [{ message: 'no auth' }] });

      expect(res.status).toBe(401);
    });

    it('accepts a valid batch of errors', async () => {
      const res = await request(app)
        .post('/api/errors/batch')
        .set('x-api-key', VALID_API_KEY)
        .send({
          errors: [
            { message: 'Error one', timestamp: '2026-02-24T12:00:00.000Z' },
            { message: 'Error two', stack: 'Error: two\n  at x.js:1:1' },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('ok');
      expect(res.body.accepted).toBe(2);
    });

    it('rejects an empty batch', async () => {
      const res = await request(app)
        .post('/api/errors/batch')
        .set('x-api-key', VALID_API_KEY)
        .send({ errors: [] });

      expect(res.status).toBe(400);
    });

    it('rejects batch with invalid error payload', async () => {
      const res = await request(app)
        .post('/api/errors/batch')
        .set('x-api-key', VALID_API_KEY)
        .send({ errors: [{ message: '' }] });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/errors', () => {
    it('returns paginated errors', async () => {
      const res = await request(app)
        .get('/api/errors')
        .set('x-api-key', VALID_API_KEY);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('pagination');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.pagination).toHaveProperty('page');
      expect(res.body.pagination).toHaveProperty('total');
      expect(res.body.pagination).toHaveProperty('totalPages');
    });
  });

  describe('Auth endpoints', () => {
    it('POST /api/auth/register creates a user and returns a token', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'new@test.com', password: 'SecurePass1' });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('ok');
      expect(res.body).toHaveProperty('token');
      expect(res.body.user.email).toBe('new@test.com');
    });

    it('POST /api/auth/register rejects duplicate email', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'existing@test.com', password: 'SecurePass1' });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('already exists');
    });

    it('POST /api/auth/register rejects short password', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'new@test.com', password: 'Ab1' });

      expect(res.status).toBe(400);
    });

    it('POST /api/auth/login succeeds with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@test.com', password: 'ValidPass1' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body).toHaveProperty('token');
      expect(res.body.user.email).toBe('test@test.com');
    });

    it('POST /api/auth/login rejects wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@test.com', password: 'WrongPass1' });

      expect(res.status).toBe(401);
      expect(res.body.message).toContain('Invalid credentials');
    });

    it('POST /api/auth/login rejects unknown email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'unknown@test.com', password: 'AnyPass123' });

      expect(res.status).toBe(401);
      expect(res.body.message).toContain('Invalid credentials');
    });

    it('GET /api/auth/me returns user for valid session', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer valid-session-token');

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('test@test.com');
    });

    it('GET /api/auth/me rejects invalid session', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(res.status).toBe(401);
    });

    it('POST /api/auth/logout succeeds', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer valid-session-token');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });

  describe('Rate limiting', () => {
    it('includes rate limit headers', async () => {
      const res = await request(app).get('/health');
      expect(res.headers).toHaveProperty('x-ratelimit-limit');
      expect(res.headers).toHaveProperty('x-ratelimit-remaining');
    });
  });

  describe('Project endpoints', () => {
    const SESSION_HEADER = ['Authorization', 'Bearer valid-session-token'];

    it('GET /api/projects requires session auth', async () => {
      const res = await request(app).get('/api/projects');
      expect(res.status).toBe(401);
    });

    it('GET /api/projects returns project list', async () => {
      const res = await request(app)
        .get('/api/projects')
        .set(...SESSION_HEADER);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data[0]).toHaveProperty('api_key');
    });

    it('POST /api/projects creates a project', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set(...SESSION_HEADER)
        .send({ name: 'my-new-app' });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('my-new-app');
      expect(res.body.data).toHaveProperty('api_key');
    });

    it('POST /api/projects rejects empty name', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set(...SESSION_HEADER)
        .send({ name: '' });

      expect(res.status).toBe(400);
    });

    it('DELETE /api/projects/:id deletes a project', async () => {
      const res = await request(app)
        .delete('/api/projects/1')
        .set(...SESSION_HEADER);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });

    it('DELETE /api/projects/:id returns 404 for missing project', async () => {
      const res = await request(app)
        .delete('/api/projects/999')
        .set(...SESSION_HEADER);

      expect(res.status).toBe(404);
    });

    it('POST /api/projects/:id/rotate-key rotates the API key', async () => {
      const res = await request(app)
        .post('/api/projects/1/rotate-key')
        .set(...SESSION_HEADER);

      expect(res.status).toBe(200);
      expect(res.body.data.api_key).toBe('rotated-key-789');
    });
  });

  describe('Dual-auth on error routes', () => {
    const SESSION_HEADER: [string, string] = [
      'Authorization',
      'Bearer valid-session-token',
    ];

    it('GET /api/errors with session auth returns scoped errors', async () => {
      const res = await request(app)
        .get('/api/errors')
        .set(...SESSION_HEADER);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('pagination');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('POST /api/errors with session auth (no project) returns 403', async () => {
      const res = await request(app)
        .post('/api/errors')
        .set(...SESSION_HEADER)
        .send({ message: 'session-only error' });

      // Session auth doesn't provide projectId → 403 from error route
      expect(res.status).toBe(403);
    });

    it('GET /api/errors requires some auth', async () => {
      const res = await request(app).get('/api/errors');

      expect(res.status).toBe(401);
    });
  });

  describe('Password policy edge cases', () => {
    it('rejects password missing uppercase', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'policy1@test.com', password: 'securepass1' });

      expect(res.status).toBe(400);
    });

    it('rejects password missing lowercase', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'policy2@test.com', password: 'SECUREPASS1' });

      expect(res.status).toBe(400);
    });

    it('rejects password missing digit', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'policy3@test.com', password: 'SecurePass' });

      expect(res.status).toBe(400);
    });
  });
});
