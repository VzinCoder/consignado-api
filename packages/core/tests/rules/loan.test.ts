import { describe, expect, it } from 'vitest';
import {
  checkMargin,
  maxInstallmentCents,
  maxPrincipalCents,
  priceInstallmentCents,
} from '../../src/rules/loan';

describe('loan math', () => {
  it('calculates the Price installment', () => {
    expect(priceInstallmentCents(1_000_000, 0.02, 12)).toBe(94_560);
  });

  it('limits the installment to 35% of the salary', () => {
    expect(maxInstallmentCents(500_000)).toBe(175_000);
  });

  it('finds the largest principal that fits an installment (rounded down to reais)', () => {
    const principal = maxPrincipalCents(94_560, 0.02, 12);
    expect(principal % 100).toBe(0);
    expect(priceInstallmentCents(principal, 0.02, 12)).toBeLessThanOrEqual(94_560);
    expect(priceInstallmentCents(principal + 100, 0.02, 12)).toBeGreaterThan(94_560 - 100);
  });

  it('pre-filters by margin and suggests the maximum amount', () => {
    const tooHigh = checkMargin(200_000, 5_000_000, 12, 0.0155);
    expect(tooHigh.fits).toBe(false);
    expect(priceInstallmentCents(tooHigh.maxAmountCents, 0.0155, 12)).toBeLessThanOrEqual(70_000);

    expect(checkMargin(500_000, 1_000_000, 48, 0.0155).fits).toBe(true);
  });
});
