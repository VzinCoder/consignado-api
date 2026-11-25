import { invalidRequest } from '@/lib/http-error';
import { loanTermsSchema } from '@/lib/schemas';
import { getContainer, handle, readJson } from '@/lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function POST(request: Request) {
  return handle(async () => {
    const parsed = loanTermsSchema.safeParse(await readJson(request));
    if (!parsed.success) return invalidRequest(parsed.error);
    return Response.json(getContainer().simulationService.checkMargin(parsed.data));
  });
}
