import type { FastifyPluginCallback } from 'fastify';
import { z } from 'zod';
import { behave, evaluate, toCents, toReais, type BankProfile } from '../engine';
import type { BankRouteDeps } from './types';

/** Banco Mandacaru: traditional, lowest rate, most restrictive. Portuguese fields, rate as "1,65%". */
export const mandacaruProfile: BankProfile = {
  minMonthlyRate: 0.0155,
  maxMonthlyRate: 0.018,
  minSalaryCents: 300_000,
  marginRatio: 0.3,
  minAmountCents: 200_000,
  maxAmountCents: 8_000_000,
  minTermMonths: 12,
  maxTermMonths: 84,
};

const PERCENT = 100;

const requestSchema = z.object({
  documento: z.string().regex(/^\d{11}$/),
  renda: z.number().positive(),
  valorSolicitado: z.number().positive(),
  prazoMeses: z.number().int().positive(),
});

/** 0.0165 -> "1,65%" */
export function formatRateText(rate: number): string {
  return `${(rate * PERCENT).toFixed(2).replace('.', ',')}%`;
}

export function mandacaruRoutes({ behavior, runtime }: BankRouteDeps): FastifyPluginCallback {
  return (app, _options, done) => {
    app.post('/simulacao', async (request, reply) => {
      const parsed = requestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ mensagem: 'Requisição inválida' });
      }
      const body = parsed.data;

      const { fail } = await behave(behavior, runtime, body.documento);
      if (fail) {
        return reply.code(503).send({ mensagem: 'Serviço temporariamente indisponível' });
      }

      const result = evaluate(mandacaruProfile, {
        cpf: body.documento,
        salaryCents: toCents(body.renda),
        amountCents: toCents(body.valorSolicitado),
        termMonths: body.prazoMeses,
      });

      if (result.kind === 'rejected') {
        return { situacao: 'RECUSADA', motivo: result.reason };
      }
      return {
        situacao: 'APROVADA',
        taxaMensal: formatRateText(result.monthlyRate),
        valorLiberado: toReais(result.amountCents),
        valorParcela: toReais(result.installmentCents),
        valorTotal: toReais(result.totalCents),
        prazoMeses: result.termMonths,
      };
    });
    done();
  };
}
