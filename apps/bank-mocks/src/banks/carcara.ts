import type { FastifyPluginCallback } from 'fastify';
import { z } from 'zod';
import { behave, evaluate, toCents, toReais, type BankProfile } from '../engine';
import type { BankRouteDeps } from './types';

/** Carcará Financeira: instável, maior taxa. Sempre retorna HTTP 200; erros vêm no corpo. */
export const carcaraProfile: BankProfile = {
  minMonthlyRate: 0.0199,
  maxMonthlyRate: 0.0249,
  minSalaryCents: 100_000,
  marginRatio: 0.35,
  minAmountCents: 50_000,
  maxAmountCents: 5_000_000,
  minTermMonths: 6,
  maxTermMonths: 72,
};

const PERCENT = 100;

const requestSchema = z.object({
  cpf: z.string().regex(/^\d{11}$/),
  salario: z.number().positive(),
  valor: z.number().positive(),
  parcelas: z.number().int().positive(),
});

export function carcaraRoutes({ behavior, runtime }: BankRouteDeps): FastifyPluginCallback {
  return (app, _options, done) => {
    app.post('/proposta', async (request) => {
      const parsed = requestSchema.safeParse(request.body);
      if (!parsed.success) {
        return {
          sucesso: false,
          erro: { codigo: 'DADOS_INVALIDOS', mensagem: 'Dados da proposta inválidos' },
        };
      }
      const body = parsed.data;

      const { fail } = await behave(behavior, runtime, body.cpf);
      if (fail) {
        return {
          sucesso: false,
          erro: { codigo: 'ERRO_INTERNO', mensagem: 'Não foi possível processar a proposta' },
        };
      }

      const result = evaluate(carcaraProfile, {
        cpf: body.cpf,
        salaryCents: toCents(body.salario),
        amountCents: toCents(body.valor),
        termMonths: body.parcelas,
      });

      if (result.kind === 'rejected') {
        return { sucesso: true, aprovado: false, motivo: result.reason };
      }
      return {
        sucesso: true,
        aprovado: true,
        proposta: {
          taxa_mensal_percentual: Number((result.monthlyRate * PERCENT).toFixed(2)),
          valor_liberado: toReais(result.amountCents),
          valor_parcela: toReais(result.installmentCents),
          valor_total: toReais(result.totalCents),
          parcelas: result.termMonths,
        },
      };
    });
    done();
  };
}
