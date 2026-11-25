import { afterAll, describe, expect, it } from 'vitest';
import { createTestApp } from './helpers/app';

const { app, close } = createTestApp();
afterAll(close);

describe('GET /health', () => {
  it('responds ok', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
  });
});
