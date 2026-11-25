import { z } from 'zod';

/** Browser-side client: every response is `unknown` until validated by a schema. */

const statusSchema = z.enum(['PROCESSING', 'COMPLETED', 'INTERESTED', 'EXPIRED']);
const resultStatusSchema = z.enum(['PENDING', 'APPROVED', 'REJECTED', 'FAILED']);

const offerSchema = z.object({
  monthlyRate: z.number(),
  approvedAmountCents: z.number(),
  installmentCents: z.number(),
  totalCents: z.number(),
  termMonths: z.number(),
});

export const bankResultViewSchema = z.object({
  bankSlug: z.string(),
  bankName: z.string(),
  status: resultStatusSchema,
  offer: offerSchema.nullable(),
  rejectionReason: z.string().nullable(),
  isBest: z.boolean(),
});

export const publicSimulationSchema = z.object({
  id: z.string(),
  customerFirstName: z.string(),
  status: statusSchema,
  salaryCents: z.number(),
  requestedAmountCents: z.number(),
  termMonths: z.number(),
  createdAt: z.string(),
  expiresAt: z.string(),
  chosenBankSlug: z.string().nullable(),
  interestAt: z.string().nullable(),
  bestOfferBankSlug: z.string().nullable(),
  results: z.array(bankResultViewSchema),
});

export const marginCheckSchema = z.object({
  fits: z.boolean(),
  estimatedInstallmentCents: z.number(),
  maxInstallmentCents: z.number(),
  maxAmountCents: z.number(),
});

const idSchema = z.object({ id: z.string() });

const errorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    fields: z.record(z.string(), z.string()).optional(),
  }),
});

export type PublicSimulation = z.infer<typeof publicSimulationSchema>;
export type BankResultView = z.infer<typeof bankResultViewSchema>;
export type MarginCheck = z.infer<typeof marginCheckSchema>;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const GENERIC_ERROR = 'Não foi possível falar com o servidor. Tente novamente.';

export async function request<T>(
  url: string,
  schema: z.ZodType<T>,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const response = await fetch(url, {
    method: init.method ?? 'GET',
    headers: init.body === undefined ? undefined : { 'content-type': 'application/json' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: 'no-store',
  });
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const parsed = errorSchema.safeParse(body);
    if (parsed.success) {
      const { code, message, fields } = parsed.data.error;
      throw new ApiError(response.status, code, message, fields);
    }
    throw new ApiError(response.status, 'UNKNOWN', GENERIC_ERROR);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new ApiError(response.status, 'BAD_RESPONSE', GENERIC_ERROR);
  return parsed.data;
}

export const api = {
  checkMargin: (body: { salaryCents: number; requestedAmountCents: number; termMonths: number }) =>
    request('/api/simulations/check-margin', marginCheckSchema, { method: 'POST', body }),
  createSimulation: (body: unknown) =>
    request('/api/simulations', idSchema, { method: 'POST', body }),
  getSimulation: (id: string) => request(`/api/simulations/${id}`, publicSimulationSchema),
  registerInterest: (id: string, bankSlug: string) =>
    request(`/api/simulations/${id}/interest`, publicSimulationSchema, {
      method: 'POST',
      body: { bankSlug },
    }),
  renewSimulation: (id: string) =>
    request(`/api/simulations/${id}/renew`, idSchema, { method: 'POST' }),
};
