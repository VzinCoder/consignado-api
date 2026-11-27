import 'server-only';
import { NotFoundError, SIMULATION_NOT_FOUND } from '@zelafin/core';
import { getContainer } from '@zelafin/infra';
import { z } from 'zod';
import { toErrorResponse } from './http-error';

export { getContainer };

/** Corpo da requisição como unknown (JSON inválido vira null e falha na validação do schema). */
export async function readJson(request: Request): Promise<unknown> {
  try {
    const body: unknown = await request.json();
    return body;
  } catch {
    return null;
  }
}

/** Ids são UUIDs; qualquer outro valor não pode existir (e faria o Postgres lançar erro). */
export function parseId(id: string, notFoundMessage = SIMULATION_NOT_FOUND): string {
  if (!z.uuid().safeParse(id).success) throw new NotFoundError(notFoundMessage);
  return id;
}

/** Executa um handler e converte qualquer erro lançado na resposta JSON padrão de erro. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (error) {
    return toErrorResponse(error, (message, context) => {
      getContainer().logger.error(message, context);
    });
  }
}
