import type { BankResult, Offer, Simulation, SimulationStatus } from '../models';

/** Tempo extra após o timeout do banco antes de um resultado PENDING ser considerado travado. */
export const STALE_GRACE_MS = 30_000;
export const STALE_FAILURE_REASON = 'timeout';

const HOUR_MS = 60 * 60 * 1000;

export function expiresAt(createdAt: Date, offerTtlHours: number): Date {
  return new Date(createdAt.getTime() + offerTtlHours * HOUR_MS);
}

export function isExpired(simulation: Pick<Simulation, 'expiresAt'>, now: Date): boolean {
  return simulation.expiresAt.getTime() <= now.getTime();
}

/** Resultados PENDING iniciados antes deste instante estão travados (ex.: servidor reiniciou no meio da consulta). */
export function staleCutoff(now: Date, bankTimeoutMs: number): Date {
  return new Date(now.getTime() - bankTimeoutMs - STALE_GRACE_MS);
}

export function deriveStatus(
  simulation: Pick<Simulation, 'expiresAt' | 'chosenBankSlug'>,
  results: Pick<BankResult, 'status'>[],
  now: Date,
): SimulationStatus {
  // Um cliente que escolheu uma oferta continua sendo um lead para a equipe mesmo após a validade da oferta.
  if (!simulation.chosenBankSlug && isExpired(simulation, now)) return 'EXPIRED';
  if (results.some((r) => r.status === 'PENDING')) return 'PROCESSING';
  if (simulation.chosenBankSlug) return 'INTERESTED';
  return 'COMPLETED';
}

export type ApprovedResult = BankResult & { status: 'APPROVED'; offer: Offer };

export function isApproved(result: BankResult): result is ApprovedResult {
  return result.status === 'APPROVED' && result.offer !== null;
}

/** Menor total pago primeiro; em caso de empate, vence a menor parcela. */
export function compareOffers(a: ApprovedResult, b: ApprovedResult): number {
  return (
    a.offer.totalCents - b.offer.totalCents || a.offer.installmentCents - b.offer.installmentCents
  );
}

export type RequestedTerms = Pick<Simulation, 'requestedAmountCents' | 'termMonths'>;

/** Uma oferta para outro valor ou prazo é exibida, mas não é comparável pelo total pago. */
const matchesRequest = (result: ApprovedResult, request: RequestedTerms) =>
  result.offer.approvedAmountCents === request.requestedAmountCents &&
  result.offer.termMonths === request.termMonths;

export function pickBestOffer(
  results: BankResult[],
  request: RequestedTerms,
): ApprovedResult | null {
  const comparable = results
    .filter(isApproved)
    .filter((r) => matchesRequest(r, request))
    .sort(compareOffers);
  return comparable[0] ?? null;
}
