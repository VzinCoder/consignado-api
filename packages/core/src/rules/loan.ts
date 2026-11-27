/** Limites do consignado e matemática da Tabela Price (amortização francesa). Tudo em centavos. */

export const MARGIN_RATIO = 0.35;
export const MIN_SALARY_CENTS = 100_000;
export const MAX_SALARY_CENTS = 10_000_000;
export const MIN_AMOUNT_CENTS = 50_000;
export const MAX_AMOUNT_CENTS = 15_000_000;
export const MIN_TERM_MONTHS = 6;
export const MAX_TERM_MONTHS = 96;

export const CENTS_PER_REAL = 100;

export function maxInstallmentCents(salaryCents: number): number {
  return Math.floor(salaryCents * MARGIN_RATIO);
}

export function priceInstallmentCents(
  principalCents: number,
  monthlyRate: number,
  months: number,
): number {
  if (monthlyRate === 0) return Math.round(principalCents / months);
  return Math.round((principalCents * monthlyRate) / (1 - (1 + monthlyRate) ** -months));
}

/** Maior valor principal cuja parcela cabe em `installmentCents`, arredondado para baixo em reais inteiros. */
export function maxPrincipalCents(
  installmentCents: number,
  monthlyRate: number,
  months: number,
): number {
  const principal =
    monthlyRate === 0
      ? installmentCents * months
      : (installmentCents * (1 - (1 + monthlyRate) ** -months)) / monthlyRate;
  return Math.floor(principal / CENTS_PER_REAL) * CENTS_PER_REAL;
}

export interface MarginCheck {
  fits: boolean;
  estimatedInstallmentCents: number;
  maxInstallmentCents: number;
  maxAmountCents: number;
}

/**
 * Pré-filtro: estima a parcela com a menor taxa entre os bancos.
 * Se nem assim couber na margem, nenhum banco aprovaria. Na dúvida, deixa passar.
 */
export function checkMargin(
  salaryCents: number,
  amountCents: number,
  termMonths: number,
  lowestMonthlyRate: number,
): MarginCheck {
  const limit = maxInstallmentCents(salaryCents);
  const estimated = priceInstallmentCents(amountCents, lowestMonthlyRate, termMonths);
  return {
    fits: estimated <= limit,
    estimatedInstallmentCents: estimated,
    maxInstallmentCents: limit,
    maxAmountCents: Math.min(
      maxPrincipalCents(limit, lowestMonthlyRate, termMonths),
      MAX_AMOUNT_CENTS,
    ),
  };
}
