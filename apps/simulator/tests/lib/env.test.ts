import { readFileSync } from 'node:fs';
import { parseEnv as nodeParseEnv } from 'node:util';
import { describe, expect, it } from 'vitest';
import { parseSimulatorEnv } from '../../lib/env';

const validEnv = {
  ADMIN_USERNAME: 'admin@zelafin.com.br',
  ADMIN_PASSWORD: 'senha-forte',
  SESSION_SECRET: 'x'.repeat(32),
};

describe('parseSimulatorEnv', () => {
  it('loads a valid environment with a default public URL', () => {
    const env = parseSimulatorEnv(validEnv);
    expect(env.ADMIN_USERNAME).toBe('admin@zelafin.com.br');
    expect(env.PUBLIC_APP_URL).toBe('http://localhost:3000');
  });

  it('requires the admin username to be an e-mail (the login asks for one)', () => {
    expect(() => parseSimulatorEnv({ ...validEnv, ADMIN_USERNAME: 'admin' })).toThrow(
      /ADMIN_USERNAME/,
    );
  });

  it('fails naming SESSION_SECRET when shorter than 32 characters', () => {
    expect(() => parseSimulatorEnv({ ...validEnv, SESSION_SECRET: 'curto' })).toThrow(
      /SESSION_SECRET/,
    );
  });

  it('fails naming PUBLIC_APP_URL when it is not a URL', () => {
    expect(() => parseSimulatorEnv({ ...validEnv, PUBLIC_APP_URL: 'zelafin' })).toThrow(
      /PUBLIC_APP_URL/,
    );
  });

  it('accepts the .env.example file as is', () => {
    const example = readFileSync(new URL('../../../../.env.example', import.meta.url), 'utf8');
    expect(() => parseSimulatorEnv(nodeParseEnv(example))).not.toThrow();
  });
});
