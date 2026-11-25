import { NotFoundError } from '@zelafin/core';
import { adminApiGuard } from '@/lib/admin-auth';
import { getContainer, handle, parseId } from '@/lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Manual retry of a FAILED bank; waits for the bank answer (bounded by BANK_TIMEOUT_MS). */
export function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const denied = await adminApiGuard();
    if (denied) return denied;

    const id = parseId((await params).id, 'Resposta do banco');
    const result = await getContainer().bankQueryService.retry(id);
    if (!result) throw new NotFoundError('Resposta do banco');
    return Response.json({ status: result.status });
  });
}
