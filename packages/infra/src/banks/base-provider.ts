import {
  BankIntegrationError,
  CENTS_PER_REAL,
  type BankProvider,
  type BankQuote,
  type BankQuoteRequest,
} from '@zelafin/core';
import type { z } from 'zod';
import { OUT_OF_CONTRACT, postJson, type FetchFn, type HttpResponse } from './http-client';

export interface ProviderOptions {
  baseUrl: string;
  timeoutMs: number;
  fetch?: FetchFn;
}

export const toCents = (reais: number) => Math.round(reais * CENTS_PER_REAL);
export const toReais = (cents: number) => cents / CENTS_PER_REAL;

/** Modelo base para os 4 bancos: cada um mapeia apenas sua requisição, rota e resposta. */
export abstract class HttpBankProvider<TResponse> implements BankProvider {
  abstract readonly slug: string;
  abstract readonly name: string;
  abstract readonly minMonthlyRate: number;
  protected abstract readonly path: string;
  protected abstract readonly responseSchema: z.ZodType<TResponse>;

  constructor(private readonly options: ProviderOptions) {}

  protected abstract buildRequest(request: BankQuoteRequest): unknown;
  protected abstract toQuote(response: TResponse, raw: unknown): BankQuote;

  /** Padrão: 4xx/5xx é falha técnica. Carcará sobrescreve (sempre retorna 200). */
  protected checkStatus(response: HttpResponse): void {
    if (response.status >= 400) throw new BankIntegrationError(`HTTP ${response.status}`);
  }

  async simulate(request: BankQuoteRequest): Promise<BankQuote> {
    const url = new URL(this.path, this.options.baseUrl).toString();
    const response = await postJson(url, this.buildRequest(request), {
      timeoutMs: this.options.timeoutMs,
      fetch: this.options.fetch,
    });
    this.checkStatus(response);

    const parsed = this.responseSchema.safeParse(response.body);
    if (!parsed.success) throw new BankIntegrationError(OUT_OF_CONTRACT);
    return this.toQuote(parsed.data, response.body);
  }
}
