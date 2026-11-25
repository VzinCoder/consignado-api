import { describe, expect, it } from 'vitest';
import {
  BankIntegrationError,
  BankResultNotRetryableError,
  SimulationExpiredError,
} from '../errors';
import { approvingBehavior, rejectingBehavior } from '../testing';
import { OFFER_TTL_HOURS, setup, validRequest } from './test-setup';

const HOUR_MS = 60 * 60 * 1000;

async function created() {
  const ctx = setup();
  const { id } = await ctx.simulationService.create(validRequest);
  const resultOf = (slug: string) => {
    const found = ctx.store.resultsOf(id).find((r) => r.bankSlug === slug);
    if (!found) throw new Error(`result ${slug} not found`);
    return found;
  };
  return { ...ctx, id, resultOf };
}

describe('BankQueryService.query', () => {
  it('stores an approved offer and the request sent to the bank', async () => {
    const { bankQueryService, resultOf, provider } = await created();
    const saved = await bankQueryService.query(resultOf('ipe').id);

    expect(saved?.status).toBe('APPROVED');
    expect(saved?.offer?.monthlyRate).toBe(0.018);
    expect(saved?.respondedAt).not.toBeNull();
    expect(provider('ipe').calls[0]).toEqual({
      cpf: validRequest.cpf,
      salaryCents: validRequest.salaryCents,
      amountCents: validRequest.requestedAmountCents,
      termMonths: validRequest.termMonths,
    });
  });

  it('stores a rejection with its reason', async () => {
    const { bankQueryService, resultOf, provider } = await created();
    provider('mandacaru').behavior = rejectingBehavior('Salário abaixo do mínimo');
    const saved = await bankQueryService.query(resultOf('mandacaru').id);
    expect(saved).toMatchObject({
      status: 'REJECTED',
      rejectionReason: 'Salário abaixo do mínimo',
    });
  });

  it('turns integration errors (e.g. timeout) into FAILED with the technical reason', async () => {
    const { bankQueryService, resultOf, provider } = await created();
    provider('carcara').behavior = () =>
      Promise.reject(new BankIntegrationError('timeout após 5000 ms'));
    const saved = await bankQueryService.query(resultOf('carcara').id);
    expect(saved).toMatchObject({ status: 'FAILED', failureReason: 'timeout após 5000 ms' });
  });

  it('turns unexpected errors into FAILED and logs them', async () => {
    const { bankQueryService, resultOf, provider, logger } = await created();
    provider('jangada').behavior = () => Promise.reject(new TypeError('boom'));
    const saved = await bankQueryService.query(resultOf('jangada').id);
    expect(saved?.status).toBe('FAILED');
    expect(logger.entries.some((e) => e.level === 'error')).toBe(true);
  });

  it('does not overwrite a result that is no longer PENDING', async () => {
    const { bankQueryService, resultOf, provider } = await created();
    await bankQueryService.query(resultOf('ipe').id);
    provider('ipe').behavior = rejectingBehavior('mudou de ideia');
    const again = await bankQueryService.query(resultOf('ipe').id);
    expect(again?.status).toBe('APPROVED');
    expect(provider('ipe').calls).toHaveLength(1);
  });

  it('never logs personal data', async () => {
    const { bankQueryService, id, logger } = await created();
    await bankQueryService.querySimulation(id);
    const logs = JSON.stringify(logger.entries);
    expect(logs).not.toContain(validRequest.cpf);
    expect(logs).not.toContain(String(validRequest.salaryCents));
    expect(logs).not.toContain(validRequest.email);
    expect(logger.entries.filter((e) => e.message === 'consulta ao banco concluída')).toHaveLength(
      4,
    );
  });
});

describe('BankQueryService.querySimulation', () => {
  it('queries all banks in parallel and one failure does not stop the others', async () => {
    const { bankQueryService, id, store, provider } = await created();
    provider('carcara').behavior = () => Promise.reject(new BankIntegrationError('HTTP 503'));
    await bankQueryService.querySimulation(id);

    const statuses = Object.fromEntries(store.resultsOf(id).map((r) => [r.bankSlug, r.status]));
    expect(statuses).toEqual({
      ipe: 'APPROVED',
      mandacaru: 'APPROVED',
      jangada: 'APPROVED',
      carcara: 'FAILED',
    });
  });
});

describe('BankQueryService.retry', () => {
  it('queries a FAILED bank again', async () => {
    const { bankQueryService, id, resultOf, provider } = await created();
    provider('carcara').behavior = () => Promise.reject(new BankIntegrationError('HTTP 503'));
    await bankQueryService.querySimulation(id);

    provider('carcara').behavior = approvingBehavior(0.022);
    const retried = await bankQueryService.retry(resultOf('carcara').id);
    expect(retried?.status).toBe('APPROVED');
  });

  it('refuses a result that is not FAILED', async () => {
    const { bankQueryService, id, resultOf } = await created();
    await bankQueryService.querySimulation(id);
    await expect(bankQueryService.retry(resultOf('ipe').id)).rejects.toBeInstanceOf(
      BankResultNotRetryableError,
    );
  });

  it('refuses an expired simulation', async () => {
    const { bankQueryService, id, resultOf, provider, clock } = await created();
    provider('carcara').behavior = () => Promise.reject(new BankIntegrationError('HTTP 503'));
    await bankQueryService.querySimulation(id);
    clock.advance(OFFER_TTL_HOURS * HOUR_MS + 1);

    await expect(bankQueryService.retry(resultOf('carcara').id)).rejects.toBeInstanceOf(
      SimulationExpiredError,
    );
  });
});
