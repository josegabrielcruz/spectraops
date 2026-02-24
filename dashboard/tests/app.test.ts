import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the fetch API for dashboard error fetching
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock localStorage for auth headers
const mockStorage: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: (key: string) => mockStorage[key] ?? null,
  setItem: (key: string, val: string) => {
    mockStorage[key] = val;
  },
  removeItem: (key: string) => {
    delete mockStorage[key];
  },
});

describe('dashboard API client', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    // Reset module cache so dynamic imports get fresh mocks
    vi.resetModules();
    // Set a session token for auth
    mockStorage['spectraops_token'] = 'test-session-token';
  });

  it('fetchErrors calls the correct API endpoint with pagination params', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 1,
            message: 'Test error',
            stack: null,
            created_at: '2026-01-01T00:00:00.000Z',
          },
        ],
        pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
      }),
    });

    const { fetchErrors } = await import('../src/api/errors');
    const result = await fetchErrors({ page: 1 });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('/api/errors');
    expect(url).toContain('page=1');
    expect(result.data).toHaveLength(1);
    expect(result.data[0].message).toBe('Test error');
    expect(result.pagination.total).toBe(1);
  });

  it('fetchErrors sends session auth header', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [],
        pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
      }),
    });

    const { fetchErrors } = await import('../src/api/errors');
    await fetchErrors();

    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers['Authorization']).toBe('Bearer test-session-token');
  });

  it('fetchErrors throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    const { fetchErrors } = await import('../src/api/errors');
    await expect(fetchErrors()).rejects.toThrow('Failed to fetch errors');
  });
});
