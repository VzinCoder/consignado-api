import { BankIntegrationError } from '@zelafin/core';

export type FetchFn = (input: string, init: RequestInit) => Promise<Response>;

export interface HttpResponse {
  status: number;
  body: unknown;
}

export interface PostJsonOptions {
  timeoutMs: number;
  fetch?: FetchFn;
}

function isTimeout(error: unknown): boolean {
  return (
    error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError')
  );
}

/**
 * POSTs JSON and returns status + parsed body. HTTP status is NOT judged here:
 * some banks (Carcará) answer 200 for errors, so each provider decides.
 * Timeout, network failure and non-JSON bodies become BankIntegrationError.
 */
export async function postJson(
  url: string,
  payload: unknown,
  { timeoutMs, fetch: fetchFn = fetch }: PostJsonOptions,
): Promise<HttpResponse> {
  let response: Response;
  try {
    response = await fetchFn(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (isTimeout(error)) throw new BankIntegrationError(`timeout após ${timeoutMs} ms`);
    throw new BankIntegrationError('erro de rede ao chamar o banco');
  }

  let text: string;
  try {
    text = await response.text();
  } catch (error) {
    if (isTimeout(error)) throw new BankIntegrationError(`timeout após ${timeoutMs} ms`);
    throw new BankIntegrationError('erro de rede ao ler a resposta do banco');
  }

  try {
    const body: unknown = JSON.parse(text);
    return { status: response.status, body };
  } catch {
    throw new BankIntegrationError(`HTTP ${response.status} com corpo que não é JSON`);
  }
}

export const OUT_OF_CONTRACT = 'resposta fora do contrato';
