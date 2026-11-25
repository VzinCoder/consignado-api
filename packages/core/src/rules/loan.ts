/** Consignado limits and Price (French amortization) math. All money in cents. */

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

/** Largest principal whose installment fits `installmentCents`, rounded down to whole reais. */
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
 * Pre-filter: estimates the installment with the lowest rate among banks.
 * If even that does not fit the margin, no bank would approve. When in doubt, let it pass.
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
