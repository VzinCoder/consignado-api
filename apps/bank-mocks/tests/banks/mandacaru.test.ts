import { afterAll, describe, expect, it } from 'vitest';
import { ERROR_CPF, OK_CPF, createTestApp } from '../helpers/app';

const { post, close } = createTestApp();
afterAll(close);

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
