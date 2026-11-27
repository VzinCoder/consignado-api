import { describe, expect, it } from 'vitest';
import { ipeProfile } from '../src/banks/ipe';
import {
  behave,
  evaluate,
  forcedOutcome,
  priceInstallmentCents,
  rateForTerm,
  SLOW_RESPONSE_MS,
  type Runtime,
} from '../src/engine';

const request = {
  cpf: '52998224725',
  salaryCents: 500_000,
  amountCents: 1_000_000,
  termMonths: 48,
};

describe('priceInstallmentCents', () => {
  it('calculates the Price installment', () => {
    // R$ 10.000 a 2% por 12 meses = R$ 945,60
    expect(priceInstallmentCents(1_000_000, 0.02, 12)).toBe(94_560);
  });

  it('splits evenly without interest', () => {
    expect(priceInstallmentCents(120_000, 0, 12)).toBe(10_000);
  });
});

describe('rateForTerm', () => {
  it('uses the minimum rate on the shortest term and the maximum on the longest', () => {
    expect(rateForTerm(ipeProfile, ipeProfile.minTermMonths)).toBe(ipeProfile.minMonthlyRate);
    expect(rateForTerm(ipeProfile, ipeProfile.maxTermMonths)).toBe(ipeProfile.maxMonthlyRate);
  });
});

describe('forcedOutcome', () => {
  it('maps the last CPF digit', () => {
    expect(forcedOutcome('52998224720')).toBe('reject');
    expect(forcedOutcome('52998224729')).toBe('error');
    expect(forcedOutcome('52998224728')).toBe('slow');
    expect(forcedOutcome('52998224725')).toBeNull();
  });
});

describe('evaluate', () => {
  it('approves a request inside the rules', () => {
    const result = evaluate(ipeProfile, request);
    expect(result.kind).toBe('approved');
  });

  it('rejects CPF ending in 0', () => {
    expect(evaluate(ipeProfile, { ...request, cpf: '11144477730' })).toMatchObject({
      kind: 'rejected',
      code: 'CREDIT_POLICY',
    });
  });

  it('rejects salary below minimum', () => {
    expect(evaluate(ipeProfile, { ...request, salaryCents: 100_000 })).toMatchObject({
      code: 'SALARY_BELOW_MINIMUM',
    });
  });

  it('rejects amount and term out of range', () => {
    expect(evaluate(ipeProfile, { ...request, amountCents: 50_000 })).toMatchObject({
      code: 'AMOUNT_OUT_OF_RANGE',
    });
    expect(evaluate(ipeProfile, { ...request, termMonths: 120 })).toMatchObject({
      code: 'TERM_OUT_OF_RANGE',
    });
  });

  it('rejects when the installment exceeds the margin', () => {
    expect(
      evaluate(ipeProfile, { ...request, salaryCents: 160_000, amountCents: 5_000_000 }),
    ).toMatchObject({
      code: 'MARGIN_EXCEEDED',
    });
  });
});

describe('behave', () => {
  const runtime = (random: number, waits: number[]): Runtime => ({
    random: () => random,
    sleep: (ms) => {
      waits.push(ms);
      return Promise.resolve();
    },
  });

  it('fails according to the error rate', async () => {
    expect(await behave({ latencyMs: 0, errorRate: 1 }, runtime(0.5, []), '52998224725')).toEqual({
      fail: true,
    });
    expect(await behave({ latencyMs: 0, errorRate: 0 }, runtime(0.5, []), '52998224725')).toEqual({
      fail: false,
    });
  });

  it('forces error on CPF ending in 9 and slowness on 8', async () => {
    const waits: number[] = [];
    expect(
      await behave({ latencyMs: 100, errorRate: 0 }, runtime(0.5, waits), '1'.repeat(10) + '9'),
    ).toEqual({ fail: true });
    await behave({ latencyMs: 100, errorRate: 0 }, runtime(0.5, waits), '1'.repeat(10) + '8');
    expect(waits).toEqual([100, SLOW_RESPONSE_MS]);
  });
});
