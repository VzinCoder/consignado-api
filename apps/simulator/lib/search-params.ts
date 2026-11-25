import type { LoanTerms } from './schemas';

/** Defaults shown on the Landing (same values as the Pencil frame). */
export const DEFAULT_LOAN_TERMS: LoanTerms = {
  salaryCents: 350_000,
  requestedAmountCents: 500_000,
  termMonths: 24,
};

type Params = Record<string, string | string[] | undefined>;

function positiveInt(value: string | string[] | undefined): number | null {
  if (typeof value !== 'string') return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

/** Reads ?salario=&valor=&prazo= (cents and months). Not personal data, so it can travel in the URL. */
export function parseLoanTermsParams(params: Params): LoanTerms {
  return {
    salaryCents: positiveInt(params.salario) ?? DEFAULT_LOAN_TERMS.salaryCents,
    requestedAmountCents: positiveInt(params.valor) ?? DEFAULT_LOAN_TERMS.requestedAmountCents,
    termMonths: positiveInt(params.prazo) ?? DEFAULT_LOAN_TERMS.termMonths,
  };
}

export function hasLoanTermsParams(params: Params): boolean {
  return [params.salario, params.valor, params.prazo].every((v) => positiveInt(v) !== null);
}

export function loanTermsQuery(terms: LoanTerms): string {
  return new URLSearchParams({
    salario: String(terms.salaryCents),
    valor: String(terms.requestedAmountCents),
    prazo: String(terms.termMonths),
  }).toString();
}
