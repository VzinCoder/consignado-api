import { afterAll, describe, expect, it } from 'vitest';
import { ERROR_CPF, OK_CPF, createTestApp } from '../helpers/app';

const { post, close } = createTestApp();
afterAll(close);

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
