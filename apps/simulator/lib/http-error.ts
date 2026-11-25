import { DomainError, MarginExceededError, ValidationError } from '@zelafin/core';
import type { z } from 'zod';

/** The only place where errors become HTTP. Body: { error: { code, message, fields? } }. */

const STATUS_BY_CODE: Record<string, number> = {
  VALIDATION_ERROR: 422,
  MARGIN_EXCEEDED: 422,
  NOT_FOUND: 404,
  SIMULATION_EXPIRED: 410,
  OFFER_NOT_AVAILABLE: 409,
  BANK_RESULT_NOT_RETRYABLE: 409,
  UNAUTHORIZED: 401,
};

const brl = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export interface ErrorBody {
  error: { code: string; message: string; fields?: Record<string, string> };
}

export function errorJson(status: number, body: ErrorBody): Response {
  return Response.json(body, { status });
}

export function invalidRequest(error: z.ZodError): Response {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'body';
    fields[key] ??= 'Valor inválido.';
  }
  return errorJson(400, {
    error: { code: 'INVALID_REQUEST', message: 'Requisição inválida.', fields },
  });
}

export function unauthorized(): Response {
  return errorJson(401, { error: { code: 'UNAUTHORIZED', message: 'Faça login para continuar.' } });
}

export function toErrorResponse(
  error: unknown,
  log: (message: string, context: Record<string, string>) => void = () => undefined,
): Response {
  if (error instanceof ValidationError) {
    return errorJson(422, {
      error: { code: error.code, message: error.message, fields: error.fields },
    });
  }
  if (error instanceof MarginExceededError) {
    const message = `O valor pedido passa do limite para o seu salário. Você pode simular até ${brl(error.maxAmountCents)}.`;
    return errorJson(422, {
      error: { code: error.code, message, fields: { requestedAmountCents: message } },
    });
  }
  if (error instanceof DomainError) {
    return errorJson(STATUS_BY_CODE[error.code] ?? 400, {
      error: { code: error.code, message: error.message },
    });
  }
  log('erro inesperado na API', { error: error instanceof Error ? error.message : String(error) });
  return errorJson(500, {
    error: { code: 'INTERNAL_ERROR', message: 'Algo deu errado. Tente novamente em instantes.' },
  });
}
