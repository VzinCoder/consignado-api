import { z } from 'zod';
import type { LoanTerms } from './schemas';

/** Valores padrão exibidos na Landing (mesmos valores do frame no Pencil). */
export const DEFAULT_LOAN_TERMS: LoanTerms = {
  salaryCents: 350_000,
  requestedAmountCents: 500_000,
  termMonths: 24,
};

/**
 * O salário é um dado pessoal, então os termos do empréstimo trafegam entre etapas no sessionStorage da aba,
 * nunca na URL (histórico do navegador, logs do servidor e Referer manteriam esse dado).
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
    // Armazenamento bloqueado (modo anônimo): o cliente apenas digita os valores novamente.
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
