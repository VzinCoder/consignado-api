import { describe, expect, it } from 'vitest';
import { isLocalDatabase } from '../../../src/database/local-database';

describe('isLocalDatabase', () => {
  it('accepts databases on this machine', () => {
    expect(isLocalDatabase('postgres://zelafin:zelafin@localhost:5432/zelafin')).toBe(true);
    expect(isLocalDatabase('postgres://zelafin:zelafin@127.0.0.1:5432/zelafin')).toBe(true);
    expect(isLocalDatabase('postgres://zelafin:zelafin@[::1]:5432/zelafin')).toBe(true);
  });

  it('refuses remote hosts and invalid URLs', () => {
    expect(isLocalDatabase('postgres://user:pass@db.zelafin.com.br:5432/zelafin')).toBe(false);
    expect(isLocalDatabase('nao-e-url')).toBe(false);
  });
});
