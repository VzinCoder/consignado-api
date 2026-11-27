import { after } from 'next/server';
import { adminApiGuard } from '@/lib/admin-auth';
import { invalidRequest } from '@/lib/http-error';
import { createSimulationSchema } from '@/lib/schemas';
import { getContainer, handle, readJson } from '@/lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** "Simular pelo atendimento": mesmo fluxo do cliente, mas com origem ADMIN. */
export function POST(request: Request) {
  return handle(async () => {
    const denied = await adminApiGuard();
    if (denied) return denied;

    const parsed = createSimulationSchema.safeParse(await readJson(request));
    if (!parsed.success) return invalidRequest(parsed.error);

    const { simulationService, bankQueryService } = getContainer();
    const { id } = await simulationService.create({ ...parsed.data, origin: 'ADMIN' });
    after(() => bankQueryService.querySimulation(id));
    return Response.json({ id }, { status: 201 });
  });
}
