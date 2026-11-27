import { after } from 'next/server';
import { invalidRequest } from '@/lib/http-error';
import { createSimulationSchema } from '@/lib/schemas';
import { getContainer, handle, readJson } from '@/lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function POST(request: Request) {
  return handle(async () => {
    const parsed = createSimulationSchema.safeParse(await readJson(request));
    if (!parsed.success) return invalidRequest(parsed.error);

    const { simulationService, bankQueryService } = getContainer();
    const { id } = await simulationService.create({ ...parsed.data, origin: 'CUSTOMER' });

    // As consultas aos bancos começam logo após a resposta, neste mesmo servidor (sem fila no MVP).
    after(() => bankQueryService.querySimulation(id));
    return Response.json({ id }, { status: 201 });
  });
}
