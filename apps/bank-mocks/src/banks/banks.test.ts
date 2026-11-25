import { afterAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app';
import type { BankSlug } from '../config';
import type { BankBehavior, Runtime } from '../engine';

const instant: Runtime = { random: () => 0.5, sleep: () => Promise.resolve() };
const stable: BankBehavior = { latencyMs: 0, errorRate: 0 };
const banks: Record<BankSlug, BankBehavior> = {
  ipe: stable,
  mandacaru: stable,
  jangada: stable,
  carcara: stable,
};

const app = buildApp({ config: { banks, logLevel: 'silent' }, runtime: instant });
afterAll(() => app.close());

const OK_CPF = '52998224725';
const REJECT_CPF = '52998224720';
const ERROR_CPF = '52998224729';

async function post(url: string, payload: object) {
  const response = await app.inject({ method: 'POST', url, payload });
  const body: unknown = response.json();
  return { status: response.statusCode, body };
}

describe('GET /health', () => {
  it('responds ok', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
  });
});

describe('Ipê Bank', () => {
  const url = '/ipe/simulate';
  const payload = (cpf: string) => ({ cpf, salary: 5000, amount: 10000, termMonths: 48 });

  it('approves with an English contract and decimal rate', async () => {
    const { status, body } = await post(url, payload(OK_CPF));
    expect(status).toBe(200);
    expect(body).toMatchObject({
      status: 'approved',
      offer: { monthlyRate: expect.any(Number), installment: expect.any(Number), termMonths: 48 },
    });
  });

  it('rejects CPF ending in 0', async () => {
    const { body } = await post(url, payload(REJECT_CPF));
    expect(body).toMatchObject({ status: 'rejected', reason: expect.any(String) });
  });

  it('answers 503 for CPF ending in 9', async () => {
    expect((await post(url, payload(ERROR_CPF))).status).toBe(503);
  });

  it('answers 400 for invalid body', async () => {
    expect((await post(url, { salary: 5000 })).status).toBe(400);
  });
});

describe('Banco Mandacaru', () => {
  const url = '/mandacaru/simulacao';
  const payload = (documento: string) => ({
    documento,
    renda: 5000,
    valorSolicitado: 10000,
    prazoMeses: 48,
  });

  it('approves with Portuguese fields and textual rate', async () => {
    const { status, body } = await post(url, payload(OK_CPF));
    expect(status).toBe(200);
    expect(body).toMatchObject({
      situacao: 'APROVADA',
      taxaMensal: expect.stringMatching(/^\d+,\d{2}%$/),
      valorParcela: expect.any(Number),
    });
  });

  it('rejects salary below its minimum', async () => {
    const { body } = await post(url, { ...payload(OK_CPF), renda: 2500 });
    expect(body).toMatchObject({
      situacao: 'RECUSADA',
      motivo: expect.stringContaining('Salário'),
    });
  });

  it('answers 503 for CPF ending in 9 and 400 for invalid body', async () => {
    expect((await post(url, payload(ERROR_CPF))).status).toBe(503);
    expect((await post(url, { documento: OK_CPF })).status).toBe(400);
  });
});

describe('Jangada Crédito', () => {
  const url = '/jangada/v2/quotes';
  const payload = (taxId: string) => ({
    customer: { tax_id: taxId },
    income_cents: 500_000,
    amount_cents: 1_000_000,
    installments: 48,
  });

  it('approves inside an envelope with cents and status code', async () => {
    const { status, body } = await post(url, payload(OK_CPF));
    expect(status).toBe(200);
    expect(body).toMatchObject({
      data: {
        status: 'A',
        installment_cents: expect.any(Number),
        monthly_rate_bps: expect.any(Number),
      },
      meta: { request_id: expect.any(String) },
    });
  });

  it('rejects amount above its limit with a reason code', async () => {
    const { body } = await post(url, { ...payload(OK_CPF), amount_cents: 20_000_000 });
    expect(body).toMatchObject({ data: { status: 'R', reason_code: 'AMOUNT_OUT_OF_RANGE' } });
  });

  it('answers 503 for CPF ending in 9 and 400 for invalid body', async () => {
    expect((await post(url, payload(ERROR_CPF))).status).toBe(503);
    expect((await post(url, { installments: 1 })).status).toBe(400);
  });
});

describe('Carcará Financeira', () => {
  const url = '/carcara/proposta';
  const payload = (cpf: string) => ({ cpf, salario: 5000, valor: 10000, parcelas: 48 });

  it('approves with HTTP 200', async () => {
    const { status, body } = await post(url, payload(OK_CPF));
    expect(status).toBe(200);
    expect(body).toMatchObject({ sucesso: true, aprovado: true, proposta: { parcelas: 48 } });
  });

  it('rejects CPF ending in 0', async () => {
    const { body } = await post(url, payload(REJECT_CPF));
    expect(body).toMatchObject({ sucesso: true, aprovado: false, motivo: expect.any(String) });
  });

  it('reports errors in the body with HTTP 200', async () => {
    const failure = await post(url, payload(ERROR_CPF));
    expect(failure.status).toBe(200);
    expect(failure.body).toMatchObject({ sucesso: false, erro: { codigo: 'ERRO_INTERNO' } });

    const invalid = await post(url, { cpf: 'x' });
    expect(invalid.status).toBe(200);
    expect(invalid.body).toMatchObject({ sucesso: false, erro: { codigo: 'DADOS_INVALIDOS' } });
  });
});
