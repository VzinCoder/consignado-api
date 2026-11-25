import { z } from 'zod';

const DEFAULT_BANK_TIMEOUT_MS = 5000;
const DEFAULT_OFFER_TTL_HOURS = 72;
const MIN_SESSION_SECRET_LENGTH = 32;
const MIN_ADMIN_PASSWORD_LENGTH = 8;

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.url(),
  BANK_MOCKS_URL: z.url().default('http://localhost:4000'),
  BANK_TIMEOUT_MS: z.coerce.number().int().positive().default(DEFAULT_BANK_TIMEOUT_MS),
  OFFER_TTL_HOURS: z.coerce.number().int().positive().default(DEFAULT_OFFER_TTL_HOURS),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  ADMIN_USERNAME: z.string().min(1),
  ADMIN_PASSWORD: z.string().min(MIN_ADMIN_PASSWORD_LENGTH),
  SESSION_SECRET: z.string().min(MIN_SESSION_SECRET_LENGTH),
});

export type Env = z.infer<typeof envSchema>;

export class InvalidEnvError extends Error {
  constructor(details: string) {
    super(`Configuração inválida:\n${details}`);
    this.name = 'InvalidEnvError';
  }
}

/** Validates a raw environment object. Pure: does not read process.env. */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new InvalidEnvError(z.prettifyError(result.error));
  }
  return result.data;
}

let cached: Env | undefined;

/** Reads and validates process.env once, on first use (never at import time). */
export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
