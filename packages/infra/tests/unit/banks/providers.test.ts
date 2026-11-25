import type { BankProvider } from '@zelafin/core';
import { describe, expect, it } from 'vitest';
import type { FetchFn } from '../../../src/banks/http-client';
import {
  CarcaraProvider,
  IpeProvider,
  JangadaProvider,
  MandacaruProvider,
  parseRateText,
} from '../../../src/banks/providers';
import {
  BASE_URL,
  TIMEOUT_MS,
  failureReason,
  hanging,
  quoteRequest as request,
  respond,
} from '../../helpers/fake-fetch';

type ProviderFactory = (fetch: FetchFn) => BankProvider;

interface Case {
  name: string;
  make: ProviderFactory;
  approved: unknown;
  rejected: unknown;
  outOfContract: unknown;
  expectedRate: number;
}

const cases: Case[] = [
  {
    name: 'Ipê',
    make: (fetch) => new IpeProvider({ baseUrl: BASE_URL, timeoutMs: TIMEOUT_MS, fetch }),
    approved: {
      status: 'approved',
      offer: {
        monthlyRate: 0.0183,
        installment: 314.84,
        total: 15112.32,
        amount: 10000,
        termMonths: 48,
      },
    },
    rejected: { status: 'rejected', reason: 'Salário abaixo do mínimo' },
    outOfContract: { status: 'approved' },
    expectedRate: 0.0183,
  },
  {
    name: 'Mandacaru',
    make: (fetch) => new MandacaruProvider({ baseUrl: BASE_URL, timeoutMs: TIMEOUT_MS, fetch }),
    approved: {
      situacao: 'APROVADA',
      taxaMensal: '1,65%',
      valorLiberado: 10000,
      valorParcela: 314.84,
      valorTotal: 15112.32,
      prazoMeses: 48,
    },
    rejected: { situacao: 'RECUSADA', motivo: 'Salário abaixo do mínimo' },
    outOfContract: { situacao: 'APROVADA', taxaMensal: '1.65' },
    expectedRate: 0.0165,
  },
  {
    name: 'Jangada',
    make: (fetch) => new JangadaProvider({ baseUrl: BASE_URL, timeoutMs: TIMEOUT_MS, fetch }),
    approved: {
      data: {
        status: 'A',
        monthly_rate_bps: 193,
        amount_cents: 1_000_000,
        installment_cents: 31_484,
        total_cents: 1_511_232,
        installments: 48,
      },
      meta: { request_id: 'abc' },
    },
    rejected: {
      data: { status: 'R', reason_code: 'X', reason: 'Salário abaixo do mínimo' },
      meta: { request_id: 'abc' },
    },
    outOfContract: { data: { status: 'A' } },
    expectedRate: 0.0193,
  },
  {
    name: 'Carcará',
    make: (fetch) => new CarcaraProvider({ baseUrl: BASE_URL, timeoutMs: TIMEOUT_MS, fetch }),
    approved: {
      sucesso: true,
      aprovado: true,
      proposta: {
        taxa_mensal_percentual: 2.15,
        valor_liberado: 10000,
        valor_parcela: 314.84,
        valor_total: 15112.32,
        parcelas: 48,
      },
    },
    rejected: { sucesso: true, aprovado: false, motivo: 'Salário abaixo do mínimo' },
    outOfContract: { ok: true },
    expectedRate: 0.0215,
  },
];

describe.each(cases)(
  '$name provider',
  ({ make, approved, rejected, outOfContract, expectedRate }) => {
    it('normalizes an approved offer to decimal rate and cents', async () => {
      const quote = await make(respond(approved)).simulate(request);
      expect(quote).toMatchObject({
        outcome: 'APPROVED',
        offer: {
          monthlyRate: expectedRate,
          installmentCents: 31_484,
          totalCents: 1_511_232,
          approvedAmountCents: 1_000_000,
          termMonths: 48,
        },
      });
      expect(quote.raw).toEqual(approved);
    });

    it('maps a rejection with the bank reason', async () => {
      expect(await make(respond(rejected)).simulate(request)).toMatchObject({
        outcome: 'REJECTED',
        reason: 'Salário abaixo do mínimo',
      });
    });

    it('fails on a response out of contract', async () => {
      expect(await failureReason(make(respond(outOfContract)).simulate(request))).toBe(
        'resposta fora do contrato',
      );
    });

    it('fails on HTTP 503', async () => {
      expect(await failureReason(make(respond({ any: 'thing' }, 503)).simulate(request))).toBe(
        'HTTP 503',
      );
    });

    it('fails on timeout', async () => {
      expect(await failureReason(make(hanging).simulate(request))).toBe('timeout após 20 ms');
    });
  },
);

describe('bank specifics', () => {
  it('parses textual rates', () => {
    expect(parseRateText('1,65%')).toBe(0.0165);
    expect(parseRateText('1.65')).toBeNull();
  });

  it('treats Carcará HTTP 200 with sucesso=false as a failure', async () => {
    const provider = new CarcaraProvider({
      baseUrl: BASE_URL,
      timeoutMs: TIMEOUT_MS,
      fetch: respond({ sucesso: false, erro: { codigo: 'ERRO_INTERNO', mensagem: 'falhou' } }),
    });
    expect(await failureReason(provider.simulate(request))).toBe(
      'erro no corpo da resposta: ERRO_INTERNO - falhou',
    );
  });

  it('sends each bank its own request format', async () => {
    const bodies: unknown[] = [];
    const capture: FetchFn = (_url, init) => {
      bodies.push(typeof init.body === 'string' ? JSON.parse(init.body) : null);
      return Promise.resolve(new Response('{}', { status: 200 }));
    };
    for (const { make } of cases)
      await make(capture)
        .simulate(request)
        .catch(() => undefined);
    expect(bodies).toEqual([
      { cpf: request.cpf, salary: 5000, amount: 10000, termMonths: 48 },
      { documento: request.cpf, renda: 5000, valorSolicitado: 10000, prazoMeses: 48 },
      {
        customer: { tax_id: request.cpf },
        income_cents: 500_000,
        amount_cents: 1_000_000,
        installments: 48,
      },
      { cpf: request.cpf, salario: 5000, valor: 10000, parcelas: 48 },
    ]);
  });

  it('declares the lowest rate of each bank (Mandacaru is the lowest)', () => {
    const providers = cases.map(({ make }) => make(respond({})));
    const lowest = providers.reduce((a, b) => (a.minMonthlyRate <= b.minMonthlyRate ? a : b));
    expect(lowest.slug).toBe('mandacaru');
    expect(lowest.minMonthlyRate).toBe(0.0155);
  });
});
