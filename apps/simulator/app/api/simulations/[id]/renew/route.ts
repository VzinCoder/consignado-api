import { after } from 'next/server';
import { getContainer, handle, parseId } from '@/lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const id = parseId((await params).id);
    const { simulationService, bankQueryService } = getContainer();
    const renewed = await simulationService.renew(id);
    after(() => bankQueryService.querySimulation(renewed.id));
    return Response.json(renewed, { status: 201 });
  });
}
