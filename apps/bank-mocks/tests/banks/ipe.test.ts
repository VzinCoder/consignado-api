import { afterAll, describe, expect, it } from 'vitest';
import { ERROR_CPF, OK_CPF, REJECT_CPF, createTestApp } from '../helpers/app';

const { post, close } = createTestApp();
afterAll(close);

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
