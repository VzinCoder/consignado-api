import { describe, expect, it } from 'vitest';
import { NotFoundError, SIMULATION_NOT_FOUND, hasErrorCode } from '../src/errors';

describe('hasErrorCode', () => {
  it('matches a domain error by its code, even if it is a plain object copy', () => {
    expect(hasErrorCode(new NotFoundError(SIMULATION_NOT_FOUND), 'NOT_FOUND')).toBe(true);
    expect(hasErrorCode({ code: 'NOT_FOUND' }, 'NOT_FOUND')).toBe(true);
  });

  it('does not match other errors or values', () => {
    expect(hasErrorCode(new Error('boom'), 'NOT_FOUND')).toBe(false);
    expect(hasErrorCode(null, 'NOT_FOUND')).toBe(false);
  });
});
