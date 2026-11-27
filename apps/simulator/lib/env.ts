import { z } from 'zod';

/**
 * Configurações usadas apenas pelo app web (login do admin, sessão e links públicos).
 * Banco de dados, bancos parceiros e prazos são validados por @zelafin/infra, para que migrations e seed
 * nunca precisem dos segredos do admin.
 */

const MIN_SESSION_SECRET_LENGTH = 32;
const MIN_ADMIN_PASSWORD_LENGTH = 8;
const DEFAULT_PUBLIC_APP_URL = 'http://localhost:3000';

const simulatorEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  // A tela de login pede um e-mail, então o usuário precisa ser um e-mail válido.
  ADMIN_USERNAME: z.email(),
  ADMIN_PASSWORD: z.string().min(MIN_ADMIN_PASSWORD_LENGTH),
  SESSION_SECRET: z.string().min(MIN_SESSION_SECRET_LENGTH),
  /** Base dos links enviados aos clientes (nunca obtida do header Host da requisição). */
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

/** Lê e valida process.env uma única vez, no primeiro uso (nunca no import). */
export function getSimulatorEnv(): SimulatorEnv {
  cached ??= parseSimulatorEnv(process.env);
  return cached;
}
