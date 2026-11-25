import { invalidRequest } from '@/lib/http-error';
import { interestSchema } from '@/lib/schemas';
import { getContainer, handle, parseId, readJson } from '@/lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const id = parseId((await params).id);
    const parsed = interestSchema.safeParse(await readJson(request));
    if (!parsed.success) return invalidRequest(parsed.error);
    return Response.json(
      await getContainer().simulationService.registerInterest(id, parsed.data.bankSlug),
    );
  });
}
