import { BankIntegrationError, type BankQuote, type BankQuoteRequest } from '@zelafin/core';
import { z } from 'zod';
import { HttpBankProvider, toCents, toReais } from './base-provider';
import { OUT_OF_CONTRACT, type HttpResponse } from './http-client';

const PERCENT = 100;
const BASIS_POINTS = 10_000;
const RATE_DECIMALS = 6;
const roundRate = (rate: number) => Number(rate.toFixed(RATE_DECIMALS));

// ---------------------------------------------------------------- Ipê Bank
const ipeSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('approved'),
    offer: z.object({
      monthlyRate: z.number().positive(),
      installment: z.number().positive(),
      total: z.number().positive(),
      amount: z.number().positive(),
      termMonths: z.number().int().positive(),
    }),
  }),
  z.object({ status: z.literal('rejected'), reason: z.string() }),
]);

export class IpeProvider extends HttpBankProvider<z.infer<typeof ipeSchema>> {
  readonly slug = 'ipe';
  readonly name = 'Ipê Bank';
  readonly minMonthlyRate = 0.0169;
  protected readonly path = '/ipe/simulate';
  protected readonly responseSchema = ipeSchema;

  protected buildRequest(r: BankQuoteRequest) {
    return {
      cpf: r.cpf,
      salary: toReais(r.salaryCents),
      amount: toReais(r.amountCents),
      termMonths: r.termMonths,
    };
  }

  protected toQuote(response: z.infer<typeof ipeSchema>, raw: unknown): BankQuote {
    if (response.status === 'rejected')
      return { outcome: 'REJECTED', reason: response.reason, raw };
    const { offer } = response;
    return {
      outcome: 'APPROVED',
      offer: {
        monthlyRate: offer.monthlyRate,
        approvedAmountCents: toCents(offer.amount),
        installmentCents: toCents(offer.installment),
        totalCents: toCents(offer.total),
        termMonths: offer.termMonths,
      },
      raw,
    };
  }
}

// ---------------------------------------------------------------- Banco Mandacaru
const RATE_TEXT = /^(\d+),(\d+)%$/;

/** "1,65%" -> 0.0165 */
export function parseRateText(text: string): number | null {
  const match = RATE_TEXT.exec(text.trim());
  if (!match) return null;
  return roundRate(Number(`${match[1]}.${match[2]}`) / PERCENT);
}

const mandacaruSchema = z.discriminatedUnion('situacao', [
  z.object({
    situacao: z.literal('APROVADA'),
    taxaMensal: z.string().regex(RATE_TEXT),
    valorLiberado: z.number().positive(),
    valorParcela: z.number().positive(),
    valorTotal: z.number().positive(),
    prazoMeses: z.number().int().positive(),
  }),
  z.object({ situacao: z.literal('RECUSADA'), motivo: z.string() }),
]);

export class MandacaruProvider extends HttpBankProvider<z.infer<typeof mandacaruSchema>> {
  readonly slug = 'mandacaru';
  readonly name = 'Banco Mandacaru';
  readonly minMonthlyRate = 0.0155;
  protected readonly path = '/mandacaru/simulacao';
  protected readonly responseSchema = mandacaruSchema;

  protected buildRequest(r: BankQuoteRequest) {
    return {
      documento: r.cpf,
      renda: toReais(r.salaryCents),
      valorSolicitado: toReais(r.amountCents),
      prazoMeses: r.termMonths,
    };
  }

  protected toQuote(response: z.infer<typeof mandacaruSchema>, raw: unknown): BankQuote {
    if (response.situacao === 'RECUSADA') {
      return { outcome: 'REJECTED', reason: response.motivo, raw };
    }
    const monthlyRate = parseRateText(response.taxaMensal);
    if (monthlyRate === null) throw new BankIntegrationError(OUT_OF_CONTRACT);
    return {
      outcome: 'APPROVED',
      offer: {
        monthlyRate,
        approvedAmountCents: toCents(response.valorLiberado),
        installmentCents: toCents(response.valorParcela),
        totalCents: toCents(response.valorTotal),
        termMonths: response.prazoMeses,
      },
      raw,
    };
  }
}

// ---------------------------------------------------------------- Jangada Crédito
const jangadaSchema = z.object({
  data: z.discriminatedUnion('status', [
    z.object({
      status: z.literal('A'),
      monthly_rate_bps: z.number().int().positive(),
      amount_cents: z.number().int().positive(),
      installment_cents: z.number().int().positive(),
      total_cents: z.number().int().positive(),
      installments: z.number().int().positive(),
    }),
    z.object({ status: z.literal('R'), reason_code: z.string(), reason: z.string() }),
  ]),
  meta: z.object({ request_id: z.string() }),
});

export class JangadaProvider extends HttpBankProvider<z.infer<typeof jangadaSchema>> {
  readonly slug = 'jangada';
  readonly name = 'Jangada Crédito';
  readonly minMonthlyRate = 0.0179;
  protected readonly path = '/jangada/v2/quotes';
  protected readonly responseSchema = jangadaSchema;

  protected buildRequest(r: BankQuoteRequest) {
    return {
      customer: { tax_id: r.cpf },
      income_cents: r.salaryCents,
      amount_cents: r.amountCents,
      installments: r.termMonths,
    };
  }

  protected toQuote({ data }: z.infer<typeof jangadaSchema>, raw: unknown): BankQuote {
    if (data.status === 'R') return { outcome: 'REJECTED', reason: data.reason, raw };
    return {
      outcome: 'APPROVED',
      offer: {
        monthlyRate: roundRate(data.monthly_rate_bps / BASIS_POINTS),
        approvedAmountCents: data.amount_cents,
        installmentCents: data.installment_cents,
        totalCents: data.total_cents,
        termMonths: data.installments,
      },
      raw,
    };
  }
}

// ---------------------------------------------------------------- Carcará Financeira
const carcaraSchema = z.union([
  z.object({
    sucesso: z.literal(true),
    aprovado: z.literal(true),
    proposta: z.object({
      taxa_mensal_percentual: z.number().positive(),
      valor_liberado: z.number().positive(),
      valor_parcela: z.number().positive(),
      valor_total: z.number().positive(),
      parcelas: z.number().int().positive(),
    }),
  }),
  z.object({ sucesso: z.literal(true), aprovado: z.literal(false), motivo: z.string() }),
  z.object({
    sucesso: z.literal(false),
    erro: z.object({ codigo: z.string(), mensagem: z.string() }),
  }),
]);

export class CarcaraProvider extends HttpBankProvider<z.infer<typeof carcaraSchema>> {
  readonly slug = 'carcara';
  readonly name = 'Carcará Financeira';
  readonly minMonthlyRate = 0.0199;
  protected readonly path = '/carcara/proposta';
  protected readonly responseSchema = carcaraSchema;

  /** Carcará sempre responde 200; apenas um erro HTTP real (proxy, queda) falha aqui. */
  protected override checkStatus(response: HttpResponse): void {
    if (response.status >= 500) throw new BankIntegrationError(`HTTP ${response.status}`);
  }

  protected buildRequest(r: BankQuoteRequest) {
    return {
      cpf: r.cpf,
      salario: toReais(r.salaryCents),
      valor: toReais(r.amountCents),
      parcelas: r.termMonths,
    };
  }

  protected toQuote(response: z.infer<typeof carcaraSchema>, raw: unknown): BankQuote {
    if (!response.sucesso) {
      throw new BankIntegrationError(
        `erro no corpo da resposta: ${response.erro.codigo} - ${response.erro.mensagem}`,
      );
    }
    if (!response.aprovado) return { outcome: 'REJECTED', reason: response.motivo, raw };
    const { proposta } = response;
    return {
      outcome: 'APPROVED',
      offer: {
        monthlyRate: roundRate(proposta.taxa_mensal_percentual / PERCENT),
        approvedAmountCents: toCents(proposta.valor_liberado),
        installmentCents: toCents(proposta.valor_parcela),
        totalCents: toCents(proposta.valor_total),
        termMonths: proposta.parcelas,
      },
      raw,
    };
  }
}
