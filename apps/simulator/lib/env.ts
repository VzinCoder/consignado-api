import { z } from 'zod';

/**
 * Settings that only the web app uses (admin login, session and public links).
 * Database, banks and deadlines are validated by @zelafin/infra, so migrations and the seed
 * never need the admin secrets.
 */

const MIN_SESSION_SECRET_LENGTH = 32;
const MIN_ADMIN_PASSWORD_LENGTH = 8;
const DEFAULT_PUBLIC_APP_URL = 'http://localhost:3000';

const simulatorEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  // The login screen asks for an e-mail, so the username must be one.
  ADMIN_USERNAME: z.email(),
  ADMIN_PASSWORD: z.string().min(MIN_ADMIN_PASSWORD_LENGTH),
  SESSION_SECRET: z.string().min(MIN_SESSION_SECRET_LENGTH),
  /** Base of the links sent to customers (never taken from the request Host header). */
  PUBLIC_APP_URL: z.url().default(DEFAULT_PUBLIC_APP_URL),
});

export type SimulatorEnv = z.infer<typeof simulatorEnvSchema>;

export function parseSimulatorEnv(source: Record<string, string | undefined>): SimulatorEnv {
  const result = simulatorEnvSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Configuração inválida do simulador:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

let cached: SimulatorEnv | undefined;

/** Reads and validates process.env once, on first use (never at import time). */
export function getSimulatorEnv(): SimulatorEnv {
  cached ??= parseSimulatorEnv(process.env);
  return cached;
}
