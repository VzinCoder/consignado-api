import { describe, expect, it } from 'vitest';
import {
  SESSION_TTL_SECONDS,
  createSessionToken,
  safeEqual,
  verifySessionToken,
} from '../../lib/session';

const SECRET = 'x'.repeat(32);
const now = new Date('2026-11-25T12:00:00Z');

describe('session token', () => {
  it('round-trips a valid token', async () => {
    const token = await createSessionToken('admin@zelafin.com.br', SECRET, now);
    const session = await verifySessionToken(token, SECRET, now);
    expect(session?.username).toBe('admin@zelafin.com.br');
  });

  it('rejects a tampered payload or a different secret', async () => {
    const token = await createSessionToken('admin', SECRET, now);
    const [, signature] = token.split('.');
    const forged = `${btoa(JSON.stringify({ sub: 'hacker', exp: 9_999_999_999 }))}.${signature}`;
    expect(await verifySessionToken(forged, SECRET, now)).toBeNull();
    expect(await verifySessionToken(token, 'y'.repeat(32), now)).toBeNull();
    expect(await verifySessionToken('lixo', SECRET, now)).toBeNull();
    expect(await verifySessionToken(undefined, SECRET, now)).toBeNull();
  });

  it('rejects an expired token', async () => {
    const token = await createSessionToken('admin', SECRET, now);
    const later = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000);
    expect(await verifySessionToken(token, SECRET, later)).toBeNull();
  });
});

describe('safeEqual', () => {
  it('compares strings of any length', async () => {
    expect(await safeEqual('senha', 'senha')).toBe(true);
    expect(await safeEqual('senha', 'senha-longa')).toBe(false);
  });
});
