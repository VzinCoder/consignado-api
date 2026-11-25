import { z } from 'zod';
import { formatMoney } from './format';

/** The only place where errors become HTTP. Body: { error: { code, message, fields? } }. */

const VALIDATION_CODE = 'VALIDATION_ERROR';
const MARGIN_CODE = 'MARGIN_EXCEEDED';

const STATUS_BY_CODE: Record<string, number> = {
  VALIDATION_ERROR: 422,
  MARGIN_EXCEEDED: 422,
  NOT_FOUND: 404,
  SIMULATION_EXPIRED: 410,
  SIMULATION_STILL_VALID: 409,
  INTEREST_ALREADY_REGISTERED: 409,
  OFFER_NOT_AVAILABLE: 409,
  BANK_RESULT_NOT_RETRYABLE: 409,
  UNAUTHORIZED: 401,
};

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

const stringRecord = z.record(z.string(), z.string());

/**
 * Domain errors are recognized by their stable code, not by `instanceof`: the container survives
 * hot reload in `globalThis`, so its errors can come from another copy of @zelafin/core.
 * Only known codes count, so a library error that also has a `code` (e.g. Postgres) stays a 500.
 */
function domainError(error: unknown): { code: string; status: number; message: string } | null {
  if (!(error instanceof Error) || !('code' in error) || typeof error.code !== 'string') {
    return null;
  }
  const status = STATUS_BY_CODE[error.code];
  return status === undefined ? null : { code: error.code, status, message: error.message };
}

export function toErrorResponse(
  error: unknown,
  log: (message: string, context: Record<string, string>) => void = () => undefined,
): Response {
  const domain = domainError(error);
  if (domain?.code === VALIDATION_CODE && error instanceof Error && 'fields' in error) {
    const fields = stringRecord.safeParse(error.fields);
    return errorJson(422, {
      error: {
        code: domain.code,
        message: domain.message,
        fields: fields.success ? fields.data : {},
      },
    });
  }
  if (domain?.code === MARGIN_CODE && error instanceof Error && 'maxAmountCents' in error) {
    const max = typeof error.maxAmountCents === 'number' ? error.maxAmountCents : 0;
    const message = `O valor pedido passa do limite para o seu salário. Você pode simular até ${formatMoney(max)}.`;
    return errorJson(422, {
      error: { code: domain.code, message, fields: { requestedAmountCents: message } },
    });
  }
  if (domain) {
    return errorJson(domain.status, { error: { code: domain.code, message: domain.message } });
  }
  log('erro inesperado na API', { error: error instanceof Error ? error.message : String(error) });
  return errorJson(500, {
    error: { code: 'INTERNAL_ERROR', message: 'Algo deu errado. Tente novamente em instantes.' },
  });
}
