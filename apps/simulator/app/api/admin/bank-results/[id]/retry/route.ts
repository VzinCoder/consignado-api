import { BANK_RESULT_NOT_FOUND, NotFoundError } from '@zelafin/core';
import { adminApiGuard } from '@/lib/admin-auth';
import { getContainer, handle, parseId } from '@/lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Reconsulta manual de um banco FAILED; aguarda a resposta do banco (limitada por BANK_TIMEOUT_MS). */
export function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const denied = await adminApiGuard();
    if (denied) return denied;

    const id = parseId((await params).id, BANK_RESULT_NOT_FOUND);
    const result = await getContainer().bankQueryService.retry(id);
    if (!result) throw new NotFoundError(BANK_RESULT_NOT_FOUND);
    return Response.json({ status: result.status });
  });
}
