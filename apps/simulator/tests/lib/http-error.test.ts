import {
  MarginExceededError,
  NotFoundError,
  OfferNotAvailableError,
  SimulationExpiredError,
  ValidationError,
} from '@zelafin/core';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { invalidRequest, toErrorResponse } from '../../lib/http-error';

async function read(response: Response) {
  const body: unknown = await response.json();
  return { status: response.status, body };
}

describe('toErrorResponse', () => {
  it('maps validation errors to 422 with fields', async () => {
    expect(await read(toErrorResponse(new ValidationError({ cpf: 'CPF inválido.' })))).toEqual({
      status: 422,
      body: {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Alguns dados estão inválidos.',
          fields: { cpf: 'CPF inválido.' },
        },
      },
    });
  });

  it('explains the maximum amount on margin errors', async () => {
    const { status, body } = await read(toErrorResponse(new MarginExceededError(980_000, 122_500)));
    expect(status).toBe(422);
    expect(JSON.stringify(body)).toContain('R$');
    expect(body).toMatchObject({ error: { code: 'MARGIN_EXCEEDED' } });
  });

  it('maps domain codes to HTTP status', () => {
    expect(toErrorResponse(new NotFoundError('Simulação não encontrada.')).status).toBe(404);
    expect(toErrorResponse(new SimulationExpiredError()).status).toBe(410);
    expect(toErrorResponse(new OfferNotAvailableError()).status).toBe(409);
  });

  it('hides unexpected errors behind a 500 and logs them', async () => {
    const logs: string[] = [];
    const response = toErrorResponse(new Error('db down'), (message) => logs.push(message));
    const { status, body } = await read(response);
    expect(status).toBe(500);
    expect(JSON.stringify(body)).not.toContain('db down');
    expect(logs).toHaveLength(1);
  });
});

describe('invalidRequest', () => {
  it('returns 400 with the invalid paths', async () => {
    const result = z.object({ name: z.string() }).safeParse({ name: 1 });
    if (result.success) throw new Error('expected failure');
    expect(await read(invalidRequest(result.error))).toMatchObject({
      status: 400,
      body: { error: { code: 'INVALID_REQUEST', fields: { name: 'Valor inválido.' } } },
    });
  });
});
