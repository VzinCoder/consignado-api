import { describe, expect, it } from 'vitest';
import type { BankResult } from '../../src/models';
import { deriveStatus, pickBestOffer, staleCutoff } from '../../src/rules/simulation';

const now = new Date('2026-11-25T12:00:00Z');
const future = new Date('2026-11-28T12:00:00Z');
const past = new Date('2026-11-20T12:00:00Z');

function result(partial: Partial<BankResult>): BankResult {
  return {
    id: 'r',
    simulationId: 's',
    bankSlug: 'ipe',
    status: 'PENDING',
    offer: null,
    rejectionReason: null,
    failureReason: null,
    startedAt: now,
    respondedAt: null,
    durationMs: null,
    ...partial,
  };
}

const offer = (totalCents: number, installmentCents: number) => ({
  monthlyRate: 0.018,
  approvedAmountCents: 1_000_000,
  installmentCents,
  totalCents,
  termMonths: 48,
});

describe('deriveStatus', () => {
  it('derives the status from validity, choice and bank results', () => {
    const pending = [result({ status: 'PENDING' })];
    const done = [result({ status: 'APPROVED' })];
    expect(deriveStatus({ expiresAt: past, chosenBankSlug: null }, done, now)).toBe('EXPIRED');
    expect(deriveStatus({ expiresAt: future, chosenBankSlug: null }, pending, now)).toBe(
      'PROCESSING',
    );
    expect(deriveStatus({ expiresAt: future, chosenBankSlug: 'ipe' }, done, now)).toBe(
      'INTERESTED',
    );
    expect(deriveStatus({ expiresAt: future, chosenBankSlug: null }, done, now)).toBe('COMPLETED');
  });
});

describe('pickBestOffer', () => {
  it('picks the lowest total paid, then the lowest installment', () => {
    const best = pickBestOffer([
      result({ bankSlug: 'a', status: 'APPROVED', offer: offer(1_500_000, 31_000) }),
      result({ bankSlug: 'b', status: 'APPROVED', offer: offer(1_400_000, 32_000) }),
      result({ bankSlug: 'c', status: 'APPROVED', offer: offer(1_400_000, 30_000) }),
      result({ bankSlug: 'd', status: 'REJECTED' }),
    ]);
    expect(best?.bankSlug).toBe('c');
    expect(pickBestOffer([result({ status: 'FAILED' })])).toBeNull();
  });
});

describe('staleCutoff', () => {
  it('computes the stale cutoff as timeout + 30 s', () => {
    expect(staleCutoff(now, 5000).toISOString()).toBe('2026-11-25T11:59:25.000Z');
  });
});
