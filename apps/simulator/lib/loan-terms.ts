import { z } from 'zod';
import type { LoanTerms } from './schemas';

/** Defaults shown on the Landing (same values as the Pencil frame). */
export const DEFAULT_LOAN_TERMS: LoanTerms = {
  salaryCents: 350_000,
  requestedAmountCents: 500_000,
  termMonths: 24,
};

/**
 * The salary is personal data, so the loan terms travel between steps in the tab's sessionStorage,
 * never in the URL (browser history, server logs and Referer would keep it).
 */
const STORAGE_KEY = 'zelafin:loan-terms';

const storedTermsSchema = z.object({
  salaryCents: z.number().int().nonnegative(),
  requestedAmountCents: z.number().int().positive(),
  termMonths: z.number().int().positive(),
});

export function saveLoanTerms(terms: LoanTerms): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(terms));
  } catch {
    // Storage blocked (private mode): the customer just types the values again.
  }
}

export function loadLoanTerms(): LoanTerms | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = storedTermsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
