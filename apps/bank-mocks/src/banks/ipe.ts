import type { FastifyPluginCallback } from 'fastify';
import { z } from 'zod';
import { behave, evaluate, toCents, toReais, type BankProfile } from '../engine';
import type { BankRouteDeps } from './types';

/** Ipê Bank: digital, fast and stable. English JSON, values in reais, rate as decimal. */
export const ipeProfile: BankProfile = {
  minMonthlyRate: 0.0169,
  maxMonthlyRate: 0.0199,
  minSalaryCents: 150_000,
  marginRatio: 0.35,
  minAmountCents: 100_000,
  maxAmountCents: 10_000_000,
  minTermMonths: 6,
  maxTermMonths: 96,
};

const requestSchema = z.object({
  cpf: z.string().regex(/^\d{11}$/),
  salary: z.number().positive(),
  amount: z.number().positive(),
  termMonths: z.number().int().positive(),
});

export function ipeRoutes({ behavior, runtime }: BankRouteDeps): FastifyPluginCallback {
  return (app, _options, done) => {
    app.post('/simulate', async (request, reply) => {
      const parsed = requestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'invalid_request', message: 'Invalid body' });
      }
      const body = parsed.data;

      const { fail } = await behave(behavior, runtime, body.cpf);
      if (fail) {
        return reply.code(503).send({ error: 'service_unavailable' });
      }

      const result = evaluate(ipeProfile, {
        cpf: body.cpf,
        salaryCents: toCents(body.salary),
        amountCents: toCents(body.amount),
        termMonths: body.termMonths,
      });

      if (result.kind === 'rejected') {
        return { status: 'rejected', reason: result.reason };
      }
      return {
        status: 'approved',
        offer: {
          monthlyRate: result.monthlyRate,
          installment: toReais(result.installmentCents),
          total: toReais(result.totalCents),
          amount: toReais(result.amountCents),
          termMonths: result.termMonths,
        },
      };
    });
    done();
  };
}
