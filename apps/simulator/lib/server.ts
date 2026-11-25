import 'server-only';
import { NotFoundError } from '@zelafin/core';
import { getContainer } from '@zelafin/infra';
import { z } from 'zod';
import { toErrorResponse } from './http-error';

export { getContainer };

/** Request body as unknown (invalid JSON becomes null and fails schema validation). */
export async function readJson(request: Request): Promise<unknown> {
  try {
    const body: unknown = await request.json();
    return body;
  } catch {
    return null;
  }
}

/** Ids are UUIDs; anything else cannot exist (and would make Postgres throw). */
export function parseId(id: string, entity = 'Simulação'): string {
  if (!z.uuid().safeParse(id).success) throw new NotFoundError(entity);
  return id;
}

/** Runs a handler and converts any thrown error into the standard JSON error response. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (error) {
    return toErrorResponse(error, (message, context) => {
      getContainer().logger.error(message, context);
    });
  }
}
