import type { BankResult, Offer, Simulation, SimulationStatus } from '../models';

/** Extra time after the bank timeout before a PENDING result is considered stuck. */
export const STALE_GRACE_MS = 30_000;
export const STALE_FAILURE_REASON = 'timeout';

const HOUR_MS = 60 * 60 * 1000;

export function expiresAt(createdAt: Date, offerTtlHours: number): Date {
  return new Date(createdAt.getTime() + offerTtlHours * HOUR_MS);
}

export function isExpired(simulation: Pick<Simulation, 'expiresAt'>, now: Date): boolean {
  return simulation.expiresAt.getTime() <= now.getTime();
}

/** PENDING results started before this instant are stuck (e.g. server restarted mid-query). */
export function staleCutoff(now: Date, bankTimeoutMs: number): Date {
  return new Date(now.getTime() - bankTimeoutMs - STALE_GRACE_MS);
}

export function deriveStatus(
  simulation: Pick<Simulation, 'expiresAt' | 'chosenBankSlug'>,
  results: Pick<BankResult, 'status'>[],
  now: Date,
): SimulationStatus {
  // A customer who chose an offer stays a lead for the team even after the offer validity.
  if (!simulation.chosenBankSlug && isExpired(simulation, now)) return 'EXPIRED';
  if (results.some((r) => r.status === 'PENDING')) return 'PROCESSING';
  if (simulation.chosenBankSlug) return 'INTERESTED';
  return 'COMPLETED';
}

export type ApprovedResult = BankResult & { status: 'APPROVED'; offer: Offer };

export function isApproved(result: BankResult): result is ApprovedResult {
  return result.status === 'APPROVED' && result.offer !== null;
}

/** Lowest total paid first; ties go to the lowest installment. */
export function compareOffers(a: ApprovedResult, b: ApprovedResult): number {
  return (
    a.offer.totalCents - b.offer.totalCents || a.offer.installmentCents - b.offer.installmentCents
  );
}

export type RequestedTerms = Pick<Simulation, 'requestedAmountCents' | 'termMonths'>;

/** An offer for another amount or term is shown, but it is not comparable by total paid. */
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
