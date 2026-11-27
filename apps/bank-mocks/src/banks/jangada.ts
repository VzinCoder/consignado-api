import { randomUUID } from 'node:crypto';
import type { FastifyPluginCallback } from 'fastify';
import { z } from 'zod';
import { behave, evaluate, type BankProfile } from '../engine';
import type { BankRouteDeps } from './types';

/** Jangada Crédito: mais lento. Envelope { data, meta }, valores em centavos, status "A"/"R". */
export const jangadaProfile: BankProfile = {
  minMonthlyRate: 0.0179,
  maxMonthlyRate: 0.0209,
  minSalaryCents: 120_000,
  marginRatio: 0.35,
  minAmountCents: 50_000,
  maxAmountCents: 15_000_000,
  minTermMonths: 6,
  maxTermMonths: 96,
};

const BASIS_POINTS = 10_000;

const requestSchema = z.object({
  customer: z.object({ tax_id: z.string().regex(/^\d{11}$/) }),
  income_cents: z.number().int().positive(),
  amount_cents: z.number().int().positive(),
  installments: z.number().int().positive(),
});

const meta = () => ({ request_id: randomUUID(), processed_at: new Date().toISOString() });

export function jangadaRoutes({ behavior, runtime }: BankRouteDeps): FastifyPluginCallback {
  return (app, _options, done) => {
    app.post('/quotes', async (request, reply) => {
      const parsed = requestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ data: null, meta: meta(), errors: [{ code: 'BAD_REQUEST' }] });
      }
      const body = parsed.data;

      const { fail } = await behave(behavior, runtime, body.customer.tax_id);
      if (fail) {
        return reply
          .code(503)
          .send({ data: null, meta: meta(), errors: [{ code: 'UNAVAILABLE' }] });
      }

      const result = evaluate(jangadaProfile, {
        cpf: body.customer.tax_id,
        salaryCents: body.income_cents,
        amountCents: body.amount_cents,
        termMonths: body.installments,
      });

      if (result.kind === 'rejected') {
        return {
          data: { status: 'R', reason_code: result.code, reason: result.reason },
          meta: meta(),
        };
      }
      return {
        data: {
          status: 'A',
          monthly_rate_bps: Math.round(result.monthlyRate * BASIS_POINTS),
          amount_cents: result.amountCents,
          installment_cents: result.installmentCents,
          total_cents: result.totalCents,
          installments: result.termMonths,
        },
        meta: meta(),
      };
    });
    done();
  };
}
