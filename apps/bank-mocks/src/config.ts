import { z } from 'zod';
import type { BankBehavior } from './engine';

const DEFAULT_PORT = 4000;

const latency = (defaultMs: number) => z.coerce.number().int().nonnegative().default(defaultMs);
const errorRate = (defaultRate: number) => z.coerce.number().min(0).max(1).default(defaultRate);

const configSchema = z.object({
  BANK_MOCKS_PORT: z.coerce.number().int().positive().default(DEFAULT_PORT),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  IPE_LATENCY_MS: latency(300),
  IPE_ERROR_RATE: errorRate(0),
  MANDACARU_LATENCY_MS: latency(800),
  MANDACARU_ERROR_RATE: errorRate(0),
  JANGADA_LATENCY_MS: latency(2500),
  JANGADA_ERROR_RATE: errorRate(0),
  CARCARA_LATENCY_MS: latency(600),
  CARCARA_ERROR_RATE: errorRate(0.2),
});

export type BankSlug = 'ipe' | 'mandacaru' | 'jangada' | 'carcara';

export interface MocksConfig {
  port: number;
  logLevel: string;
  banks: Record<BankSlug, BankBehavior>;
}

export function loadConfig(source: Record<string, string | undefined>): MocksConfig {
  const result = configSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Configuração inválida:\n${z.prettifyError(result.error)}`);
  }
  const env = result.data;
  return {
    port: env.BANK_MOCKS_PORT,
    logLevel: env.LOG_LEVEL,
    banks: {
      ipe: { latencyMs: env.IPE_LATENCY_MS, errorRate: env.IPE_ERROR_RATE },
      mandacaru: { latencyMs: env.MANDACARU_LATENCY_MS, errorRate: env.MANDACARU_ERROR_RATE },
      jangada: { latencyMs: env.JANGADA_LATENCY_MS, errorRate: env.JANGADA_ERROR_RATE },
      carcara: { latencyMs: env.CARCARA_LATENCY_MS, errorRate: env.CARCARA_ERROR_RATE },
    },
  };
}
