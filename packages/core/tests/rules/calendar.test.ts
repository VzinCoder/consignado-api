import { describe, expect, it } from 'vitest';
import { BUSINESS_TIME_ZONE, startOfDay } from '../../src/rules/calendar';

describe('startOfDay', () => {
  it('uses the day in Brazil even when it is already tomorrow in UTC', () => {
    // 01:00 UTC on the 26th is 22:00 of the 25th in São Paulo (UTC-3).
    const now = new Date('2026-11-26T01:00:00Z');
    expect(startOfDay(now, BUSINESS_TIME_ZONE).toISOString()).toBe('2026-11-25T03:00:00.000Z');
  });

  it('works for UTC too', () => {
    expect(startOfDay(new Date('2026-11-26T01:00:00Z'), 'UTC').toISOString()).toBe(
      '2026-11-26T00:00:00.000Z',
    );
  });
});
