import { afterAll, describe, expect, it } from 'vitest';
import { ERROR_CPF, OK_CPF, REJECT_CPF, createTestApp } from '../helpers/app';

const { post, close } = createTestApp();
afterAll(close);

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
