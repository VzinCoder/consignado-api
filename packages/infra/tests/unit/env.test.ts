import { readFileSync } from 'node:fs';
import { parseEnv as nodeParseEnv } from 'node:util';
import { describe, expect, it } from 'vitest';
import { InvalidEnvError, parseEnv } from '../../src/env';

const validEnv = {
  DATABASE_URL: 'postgres://zelafin:zelafin@localhost:5432/zelafin',
  ADMIN_USERNAME: 'admin',
  ADMIN_PASSWORD: 'senha-forte',
  SESSION_SECRET: 'x'.repeat(32),
};

describe('parseEnv', () => {
  it('loads a valid environment converting types', () => {
    const env = parseEnv({ ...validEnv, BANK_TIMEOUT_MS: '3000', OFFER_TTL_HOURS: '24' });
    expect(env.BANK_TIMEOUT_MS).toBe(3000);
    expect(env.OFFER_TTL_HOURS).toBe(24);
    expect(env.DATABASE_URL).toBe(validEnv.DATABASE_URL);
  });

  it('applies defaults for business deadlines', () => {
    const env = parseEnv(validEnv);
    expect(env.BANK_TIMEOUT_MS).toBe(5000);
    expect(env.OFFER_TTL_HOURS).toBe(72);
    expect(env.BANK_MOCKS_URL).toBe('http://localhost:4000');
  });

  it('fails naming DATABASE_URL when missing', () => {
    const { DATABASE_URL: _omit, ...rest } = validEnv;
    expect(() => parseEnv(rest)).toThrow(InvalidEnvError);
    expect(() => parseEnv(rest)).toThrow(/DATABASE_URL/);
  });

  it('fails naming DATABASE_URL when it is not a URL', () => {
    expect(() => parseEnv({ ...validEnv, DATABASE_URL: 'nao-e-url' })).toThrow(/DATABASE_URL/);
  });

  it('fails naming BANK_TIMEOUT_MS when it is not a positive integer', () => {
    expect(() => parseEnv({ ...validEnv, BANK_TIMEOUT_MS: '-1' })).toThrow(/BANK_TIMEOUT_MS/);
    expect(() => parseEnv({ ...validEnv, BANK_TIMEOUT_MS: 'abc' })).toThrow(/BANK_TIMEOUT_MS/);
  });

  it('fails naming SESSION_SECRET when shorter than 32 characters', () => {
    expect(() => parseEnv({ ...validEnv, SESSION_SECRET: 'curto' })).toThrow(/SESSION_SECRET/);
  });

  it('accepts the .env.example file as is', () => {
    const example = readFileSync(new URL('../../../../.env.example', import.meta.url), 'utf8');
    expect(() => parseEnv(nodeParseEnv(example))).not.toThrow();
  });
});
