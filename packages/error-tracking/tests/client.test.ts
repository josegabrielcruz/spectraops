import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { init, captureError, flush, destroy } from '../src/client';

// Mock global fetch
const mockFetch = vi.fn().mockResolvedValue({ ok: true });
vi.stubGlobal('fetch', mockFetch);

describe('error-tracking client', () => {
  beforeEach(() => {
    destroy(); // reset state
    mockFetch.mockClear();
  });

  afterEach(() => {
    destroy();
  });

  it('captureError warns when not initialised', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    captureError(new Error('test'));
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('not initialised'),
    );
    warnSpy.mockRestore();
  });

  it('init + captureError queues an error', () => {
    init({ endpoint: 'http://localhost:3000' });
    captureError(new Error('queued error'));
    // Should not have flushed yet (batchSize defaults to 10)
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('flush sends queued errors to the batch API', async () => {
    init({ endpoint: 'http://localhost:3000' });
    captureError(new Error('flush test'));
    await flush();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('http://localhost:3000/api/errors/batch');
    expect(options.method).toBe('POST');

    const body = JSON.parse(options.body);
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0].message).toBe('flush test');
    expect(body.errors[0]).toHaveProperty('timestamp');
  });

  it('auto-flushes when batchSize is reached', () => {
    init({ endpoint: 'http://localhost:3000', batchSize: 2 });
    captureError(new Error('one'));
    expect(mockFetch).not.toHaveBeenCalled();
    captureError(new Error('two'));
    // Should have triggered a single batch flush
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.errors).toHaveLength(2);
  });

  it('sends x-api-key header when apiKey is set', async () => {
    init({ endpoint: 'http://localhost:3000', apiKey: 'test-key-123' });
    captureError(new Error('auth test'));
    await flush();

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('http://localhost:3000/api/errors/batch');
    expect(options.headers['x-api-key']).toBe('test-key-123');
  });

  it('re-queues errors on fetch failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    init({ endpoint: 'http://localhost:3000', debug: true });
    captureError(new Error('retry me'));
    await flush();

    // Error should be re-queued — a second flush should try again
    mockFetch.mockResolvedValueOnce({ ok: true });
    await flush();
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // Both calls should target the batch endpoint
    expect(mockFetch.mock.calls[0][0]).toBe(
      'http://localhost:3000/api/errors/batch',
    );
    expect(mockFetch.mock.calls[1][0]).toBe(
      'http://localhost:3000/api/errors/batch',
    );
  });

  it('destroy clears state', async () => {
    init({ endpoint: 'http://localhost:3000' });
    captureError(new Error('will be cleared'));
    destroy();
    await flush(); // should be a no-op
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
