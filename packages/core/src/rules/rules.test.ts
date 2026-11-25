import { describe, expect, it } from 'vitest';
import { ValidationError } from '../errors';
import type { BankResult } from '../models';
import { isValidCnpj, isValidCpf, maskCpf } from './documents';
import { checkMargin, maxInstallmentCents, maxPrincipalCents, priceInstallmentCents } from './loan';
import { deriveStatus, pickBestOffer, staleCutoff } from './simulation';
import {
  validateLoanTerms,
  validateSimulationRequest,
  type SimulationRequest,
} from './simulation-request';

describe('documents', () => {
  it('validates CPF check digits', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true);
    expect(isValidCpf('52998224724')).toBe(false);
    expect(isValidCpf('111.111.111-11')).toBe(false);
    expect(isValidCpf('123')).toBe(false);
  });

  it('validates CNPJ check digits', () => {
    expect(isValidCnpj('11.222.333/0001-81')).toBe(true);
    expect(isValidCnpj('11222333000182')).toBe(false);
    expect(isValidCnpj('00000000000000')).toBe(false);
  });

  it('masks the CPF keeping the middle digits', () => {
    expect(maskCpf('12345678909')).toBe('***.456.789-**');
  });
});

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

const validRequest: SimulationRequest = {
  name: '  Ana   Souza ',
  email: 'Ana@Exemplo.com ',
  phone: '(11) 98765-0001',
  cpf: '529.982.247-25',
  employerCnpj: '11.222.333/0001-81',
  salaryCents: 500_000,
  requestedAmountCents: 1_000_000,
  termMonths: 48,
  origin: 'CUSTOMER',
};

function fieldsOf(fn: () => unknown): Record<string, string> {
  try {
    fn();
  } catch (error) {
    if (error instanceof ValidationError) return error.fields;
    throw error;
  }
  return {};
}

describe('validateSimulationRequest', () => {
  it('normalizes a valid request', () => {
    expect(validateSimulationRequest(validRequest)).toMatchObject({
      name: 'Ana Souza',
      email: 'ana@exemplo.com',
      phone: '11987650001',
      cpf: '52998224725',
      employerCnpj: '11222333000181',
    });
  });

  it('reports every invalid field', () => {
    const fields = fieldsOf(() =>
      validateSimulationRequest({
        ...validRequest,
        cpf: '111.111.111-11',
        email: 'nao-e-email',
        phone: '123',
        name: 'A',
        employerCnpj: '1',
      }),
    );
    expect(Object.keys(fields).sort()).toEqual(['cpf', 'email', 'employerCnpj', 'name', 'phone']);
  });

  it('rejects loan terms out of range', () => {
    const fields = fieldsOf(() =>
      validateLoanTerms({ salaryCents: 10, requestedAmountCents: 10, termMonths: 200 }),
    );
    expect(Object.keys(fields).sort()).toEqual([
      'requestedAmountCents',
      'salaryCents',
      'termMonths',
    ]);
  });
});

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

describe('simulation rules', () => {
  it('derives the status', () => {
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

  it('computes the stale cutoff as timeout + 30 s', () => {
    expect(staleCutoff(now, 5000).toISOString()).toBe('2026-11-25T11:59:25.000Z');
  });
});
