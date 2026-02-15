import { describe, it, expect } from 'vitest';
import { captureError } from '../src/client';

describe('error-tracking client', () => {
  it('captureError is a function', () => {
    expect(typeof captureError).toBe('function');
  });
});
