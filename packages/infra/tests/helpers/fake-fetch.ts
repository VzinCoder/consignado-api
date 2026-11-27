import { BankIntegrationError } from '@zelafin/core';
import type { FetchFn } from '../../src/banks/http-client';

/** Implementações falsas de `fetch` para que testes de provider nunca acessem a rede. */
export const BASE_URL = 'http://bank.test';
export const TIMEOUT_MS = 20;

export const quoteRequest = {
  cpf: '52998224725',
  salaryCents: 500_000,
  amountCents: 1_000_000,
  termMonths: 48,
};

export const respond =
  (body: unknown, status = 200): FetchFn =>
  () =>
    Promise.resolve(new Response(JSON.stringify(body), { status }));

export const hanging: FetchFn = (_url, init) =>
  new Promise((_resolve, reject) => {
    init.signal?.addEventListener('abort', () => {
      reject(new DOMException('The operation timed out.', 'TimeoutError'));
    });
  });

export const networkDown: FetchFn = () => Promise.reject(new TypeError('fetch failed'));

/** Resolve com o motivo técnico do BankIntegrationError esperado. */
export async function failureReason(promise: Promise<unknown>): Promise<string> {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  if (!(error instanceof BankIntegrationError)) throw new Error('expected BankIntegrationError');
  return error.reason;
}
