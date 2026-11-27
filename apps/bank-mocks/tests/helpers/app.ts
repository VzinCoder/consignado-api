import { buildApp } from '../../src/app';
import type { BankSlug } from '../../src/config';
import type { BankBehavior, Runtime } from '../../src/engine';

/** CPFs cujo último dígito força o resultado (ver engine.forcedOutcome). */
export const OK_CPF = '52998224725';
export const REJECT_CPF = '52998224720';
export const ERROR_CPF = '52998224729';

const instant: Runtime = { random: () => 0.5, sleep: () => Promise.resolve() };
const stable: BankBehavior = { latencyMs: 0, errorRate: 0 };
const banks: Record<BankSlug, BankBehavior> = {
  ipe: stable,
  mandacaru: stable,
  jangada: stable,
  carcara: stable,
};

/** Monta o app de mocks sem latência e sem erros aleatórios, injetando requisições em memória. */
export function createTestApp() {
  const app = buildApp({ config: { banks, logLevel: 'silent' }, runtime: instant });

  async function post(url: string, payload: object) {
    const response = await app.inject({ method: 'POST', url, payload });
    const body: unknown = response.json();
    return { status: response.statusCode, body };
  }

  return { app, post, close: () => app.close() };
}
