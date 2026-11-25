import { getContainer, handle, parseId } from '@/lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const id = parseId((await params).id);
    return Response.json(await getContainer().simulationService.getPublic(id));
  });
}
