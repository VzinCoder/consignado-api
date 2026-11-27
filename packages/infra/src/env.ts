import { z } from 'zod';

const DEFAULT_BANK_TIMEOUT_MS = 5000;
const DEFAULT_OFFER_TTL_HOURS = 72;

/** Banco de dados, bancos parceiros, prazos e logs. Configurações de admin ficam no simulador (apps/simulator/lib/env.ts). */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.url(),
  BANK_MOCKS_URL: z.url().default('http://localhost:4000'),
  BANK_TIMEOUT_MS: z.coerce.number().int().positive().default(DEFAULT_BANK_TIMEOUT_MS),
  OFFER_TTL_HOURS: z.coerce.number().int().positive().default(DEFAULT_OFFER_TTL_HOURS),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

export type Env = z.infer<typeof envSchema>;

export class InvalidEnvError extends Error {
  constructor(details: string) {
    super(`Configuração inválida:\n${details}`);
    this.name = 'InvalidEnvError';
  }
}

/** Valida um objeto bruto de ambiente. Puro: não lê process.env. */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new InvalidEnvError(z.prettifyError(result.error));
  }
  return result.data;
}

let cached: Env | undefined;

/** Lê e valida process.env uma única vez, no primeiro uso (nunca no import). */
export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
