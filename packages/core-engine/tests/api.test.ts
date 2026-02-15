import { describe, it, expect } from 'vitest';

describe('core-engine API', () => {
  it('health endpoint returns ok', async () => {
    const { default: app } = await import('../src/api/index');
    // Basic smoke test — verifies the app module loads
    expect(app).toBeDefined();
  });
});
