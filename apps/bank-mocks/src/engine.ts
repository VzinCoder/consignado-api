/**
 * Shared rules of the fictional banks. Each bank file only translates its own contract.
 * This app represents third-party systems, so it intentionally does not import @zelafin/* packages.
 */

const RATE_DECIMALS = 4;
const CPF_FORCE_REJECT_DIGIT = '0';
const CPF_FORCE_SLOW_DIGIT = '8';
const CPF_FORCE_ERROR_DIGIT = '9';
const LATENCY_JITTER = 0.3;

/** Twice the default client timeout (5 s), so the caller always times out. */
export const SLOW_RESPONSE_MS = 10_000;

export interface BankProfile {
  minMonthlyRate: number;
  maxMonthlyRate: number;
  minSalaryCents: number;
  marginRatio: number;
  minAmountCents: number;
  maxAmountCents: number;
  minTermMonths: number;
  maxTermMonths: number;
}

export interface LoanRequest {
  cpf: string;
  salaryCents: number;
  amountCents: number;
  termMonths: number;
}

export type RejectionCode =
  | 'SALARY_BELOW_MINIMUM'
  | 'MARGIN_EXCEEDED'
  | 'AMOUNT_OUT_OF_RANGE'
  | 'TERM_OUT_OF_RANGE'
  | 'CREDIT_POLICY';

export type Evaluation =
  | {
      kind: 'approved';
      monthlyRate: number;
      installmentCents: number;
      totalCents: number;
      amountCents: number;
      termMonths: number;
    }
  | { kind: 'rejected'; code: RejectionCode; reason: string };

export type ForcedOutcome = 'reject' | 'error' | 'slow' | null;

export interface BankBehavior {
  latencyMs: number;
  errorRate: number;
}

export interface Runtime {
  random: () => number;
  sleep: (ms: number) => Promise<void>;
}

export const realRuntime: Runtime = {
  random: Math.random,
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const formatCents = (cents: number) => brl.format(cents / 100);

export function priceInstallmentCents(
  principalCents: number,
  monthlyRate: number,
  months: number,
): number {
  if (monthlyRate === 0) return Math.round(principalCents / months);
  return Math.round((principalCents * monthlyRate) / (1 - (1 + monthlyRate) ** -months));
}

/** Rate grows linearly with the term inside the bank's range. */
export function rateForTerm(profile: BankProfile, termMonths: number): number {
  const span = profile.maxTermMonths - profile.minTermMonths;
  const position = span === 0 ? 0 : (termMonths - profile.minTermMonths) / span;
  const rate =
    profile.minMonthlyRate + (profile.maxMonthlyRate - profile.minMonthlyRate) * position;
  return Number(rate.toFixed(RATE_DECIMALS));
}

export function forcedOutcome(cpf: string): ForcedOutcome {
  const last = cpf.at(-1);
  if (last === CPF_FORCE_REJECT_DIGIT) return 'reject';
  if (last === CPF_FORCE_ERROR_DIGIT) return 'error';
  if (last === CPF_FORCE_SLOW_DIGIT) return 'slow';
  return null;
}

export function evaluate(profile: BankProfile, request: LoanRequest): Evaluation {
  if (forcedOutcome(request.cpf) === 'reject') {
    return { kind: 'rejected', code: 'CREDIT_POLICY', reason: 'Recusado pela política de crédito' };
  }
  if (request.salaryCents < profile.minSalaryCents) {
    return {
      kind: 'rejected',
      code: 'SALARY_BELOW_MINIMUM',
      reason: `Salário abaixo do mínimo de ${formatCents(profile.minSalaryCents)}`,
    };
  }
  if (
    request.amountCents < profile.minAmountCents ||
    request.amountCents > profile.maxAmountCents
  ) {
    return {
      kind: 'rejected',
      code: 'AMOUNT_OUT_OF_RANGE',
      reason: `Valor fora dos limites do banco (${formatCents(profile.minAmountCents)} a ${formatCents(profile.maxAmountCents)})`,
    };
  }
  if (request.termMonths < profile.minTermMonths || request.termMonths > profile.maxTermMonths) {
    return {
      kind: 'rejected',
      code: 'TERM_OUT_OF_RANGE',
      reason: `Prazo fora dos limites do banco (${profile.minTermMonths} a ${profile.maxTermMonths} meses)`,
    };
  }

  const monthlyRate = rateForTerm(profile, request.termMonths);
  const installmentCents = priceInstallmentCents(
    request.amountCents,
    monthlyRate,
    request.termMonths,
  );
  if (installmentCents > request.salaryCents * profile.marginRatio) {
    return {
      kind: 'rejected',
      code: 'MARGIN_EXCEEDED',
      reason: `Parcela acima da margem de ${Math.round(profile.marginRatio * 100)}% do salário`,
    };
  }

  return {
    kind: 'approved',
    monthlyRate,
    installmentCents,
    totalCents: installmentCents * request.termMonths,
    amountCents: request.amountCents,
    termMonths: request.termMonths,
  };
}

/** Waits like a real bank would and tells whether this call must fail. */
export async function behave(
  behavior: BankBehavior,
  runtime: Runtime,
  cpf: string,
): Promise<{ fail: boolean }> {
  const forced = forcedOutcome(cpf);
  const jitter = 1 + (runtime.random() * 2 - 1) * LATENCY_JITTER;
  const delay = forced === 'slow' ? SLOW_RESPONSE_MS : Math.round(behavior.latencyMs * jitter);
  await runtime.sleep(delay);
  return { fail: forced === 'error' || runtime.random() < behavior.errorRate };
}

export const toCents = (reais: number) => Math.round(reais * 100);
export const toReais = (cents: number) => cents / 100;
