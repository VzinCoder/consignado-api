import { describe, expect, it } from 'vitest';
import {
  BankIntegrationError,
  InterestAlreadyRegisteredError,
  MarginExceededError,
  NotFoundError,
  OfferNotAvailableError,
  SimulationExpiredError,
  SimulationStillValidError,
  ValidationError,
} from '../../src/errors';
import { priceInstallmentCents } from '../../src/rules/loan';
import { rejectingBehavior } from '../helpers/fakes';
import { BANK_TIMEOUT_MS, OFFER_TTL_HOURS, setup, validRequest } from '../helpers/setup';

const HOUR_MS = 60 * 60 * 1000;

describe('SimulationService.create', () => {
  it('creates the customer, the simulation and one PENDING result per bank', async () => {
    const { simulationService, store, clock } = setup();
    const { id } = await simulationService.create(validRequest);

    const simulation = store.simulations.get(id);
    expect(simulation?.expiresAt.getTime()).toBe(clock.now().getTime() + OFFER_TTL_HOURS * HOUR_MS);
    expect(store.resultsOf(id).map((r) => r.status)).toEqual([
      'PENDING',
      'PENDING',
      'PENDING',
      'PENDING',
    ]);
    expect(store.customers.size).toBe(1);
  });

  it('updates the existing customer by CPF', async () => {
    const { simulationService, store } = setup();
    await simulationService.create(validRequest);
    await simulationService.create({ ...validRequest, phone: '11900000000' });

    expect(store.customers.size).toBe(1);
    expect([...store.customers.values()][0]?.phone).toBe('11900000000');
    expect(store.simulations.size).toBe(2);
  });

  it('rejects an invalid CPF with a field error', async () => {
    const { simulationService } = setup();
    const error = await simulationService
      .create({ ...validRequest, cpf: '111.111.111-11' })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ValidationError);
    expect(error instanceof ValidationError && error.fields.cpf).toBeTruthy();
  });

  it('rejects when the margin is exceeded and suggests the maximum amount', async () => {
    const { simulationService, store } = setup();
    const error = await simulationService
      .create({
        ...validRequest,
        salaryCents: 200_000,
        requestedAmountCents: 5_000_000,
        termMonths: 12,
      })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(MarginExceededError);
    if (!(error instanceof MarginExceededError)) return;
    // the lowest rate among banks (1.55%) is used for the estimate
    expect(priceInstallmentCents(error.maxAmountCents, 0.0155, 12)).toBeLessThanOrEqual(70_000);
    expect(store.simulations.size).toBe(0);
  });
});

describe('SimulationService.checkMargin', () => {
  it('tells whether the request fits before personal data', () => {
    const { simulationService } = setup();
    expect(
      simulationService.checkMargin({
        salaryCents: 500_000,
        requestedAmountCents: 1_000_000,
        termMonths: 48,
      }).fits,
    ).toBe(true);
    expect(
      simulationService.checkMargin({
        salaryCents: 200_000,
        requestedAmountCents: 5_000_000,
        termMonths: 12,
      }).fits,
    ).toBe(false);
  });
});

describe('SimulationService.getPublic', () => {
  it('hides personal data and highlights the best offer', async () => {
    const { simulationService, bankQueryService } = setup();
    const { id } = await simulationService.create(validRequest);
    await bankQueryService.querySimulation(id);

    const view = await simulationService.getPublic(id);
    const serialized = JSON.stringify(view);
    expect(serialized).not.toContain(validRequest.cpf);
    expect(serialized).not.toContain(validRequest.email);
    expect(serialized).not.toContain(validRequest.phone);

    expect(view.status).toBe('COMPLETED');
    expect(view.customerFirstName).toBe('Ana');
    expect(view.bestOfferBankSlug).toBe('mandacaru');
    expect(view.results.find((r) => r.isBest)?.bankSlug).toBe('mandacaru');
  });

  it('is PROCESSING while a bank is pending', async () => {
    const { simulationService } = setup();
    const { id } = await simulationService.create(validRequest);
    expect((await simulationService.getPublic(id)).status).toBe('PROCESSING');
  });

  it('turns stale PENDING results into FAILED (timeout + 30 s)', async () => {
    const { simulationService, clock } = setup();
    const { id } = await simulationService.create(validRequest);

    clock.advance(BANK_TIMEOUT_MS + 29_000);
    expect(
      (await simulationService.getPublic(id)).results.every((r) => r.status === 'PENDING'),
    ).toBe(true);

    clock.advance(2_000);
    const view = await simulationService.getPublic(id);
    expect(view.results.every((r) => r.status === 'FAILED')).toBe(true);
    expect(view.status).toBe('COMPLETED');
  });

  it('is EXPIRED after the offer TTL', async () => {
    const { simulationService, bankQueryService, clock } = setup();
    const { id } = await simulationService.create(validRequest);
    await bankQueryService.querySimulation(id);
    clock.advance(OFFER_TTL_HOURS * HOUR_MS);
    expect((await simulationService.getPublic(id)).status).toBe('EXPIRED');
  });

  it('throws NOT_FOUND for an unknown id', async () => {
    const { simulationService } = setup();
    await expect(simulationService.getPublic('nope')).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('SimulationService.registerInterest', () => {
  it('stores the chosen approved bank', async () => {
    const { simulationService, bankQueryService } = setup();
    const { id } = await simulationService.create(validRequest);
    await bankQueryService.querySimulation(id);

    const view = await simulationService.registerInterest(id, 'ipe');
    expect(view.chosenBankSlug).toBe('ipe');
    expect(view.status).toBe('INTERESTED');
    expect(view.interestAt).not.toBeNull();
  });

  it('refuses a bank that did not approve', async () => {
    const { simulationService, bankQueryService, provider } = setup();
    provider('jangada').behavior = rejectingBehavior('Valor acima do limite');
    const { id } = await simulationService.create(validRequest);
    await bankQueryService.querySimulation(id);

    await expect(simulationService.registerInterest(id, 'jangada')).rejects.toBeInstanceOf(
      OfferNotAvailableError,
    );
  });

  it('refuses an expired simulation', async () => {
    const { simulationService, bankQueryService, clock } = setup();
    const { id } = await simulationService.create(validRequest);
    await bankQueryService.querySimulation(id);
    clock.advance(OFFER_TTL_HOURS * HOUR_MS + 1);

    await expect(simulationService.registerInterest(id, 'ipe')).rejects.toBeInstanceOf(
      SimulationExpiredError,
    );
  });

  it('keeps the first choice: same bank again is accepted, another bank is refused', async () => {
    const { simulationService, bankQueryService } = setup();
    const { id } = await simulationService.create(validRequest);
    await bankQueryService.querySimulation(id);
    const first = await simulationService.registerInterest(id, 'ipe');

    const again = await simulationService.registerInterest(id, 'ipe');
    expect(again.interestAt).toEqual(first.interestAt);
    await expect(simulationService.registerInterest(id, 'mandacaru')).rejects.toBeInstanceOf(
      InterestAlreadyRegisteredError,
    );
    expect((await simulationService.getPublic(id)).chosenBankSlug).toBe('ipe');
  });

  it('stays INTERESTED after the offer validity (the lead is not lost)', async () => {
    const { simulationService, bankQueryService, clock } = setup();
    const { id } = await simulationService.create(validRequest);
    await bankQueryService.querySimulation(id);
    await simulationService.registerInterest(id, 'ipe');
    clock.advance(OFFER_TTL_HOURS * HOUR_MS + 1);

    expect((await simulationService.getPublic(id)).status).toBe('INTERESTED');
    expect((await simulationService.overview()).interested.map((s) => s.id)).toEqual([id]);
  });
});

describe('SimulationService admin reads', () => {
  async function seeded() {
    const ctx = setup();
    const first = await ctx.simulationService.create(validRequest);
    await ctx.bankQueryService.querySimulation(first.id);
    await ctx.simulationService.registerInterest(first.id, 'ipe');

    ctx.clock.advance(60_000);
    const second = await ctx.simulationService.create({
      ...validRequest,
      name: 'Bruno Lima',
      cpf: '11144477735',
      email: 'bruno@exemplo.com',
    });
    return { ...ctx, first, second };
  }

  it('lists most recent first with masked CPF and filters by status', async () => {
    const { simulationService, first, second } = await seeded();
    const all = await simulationService.list();
    expect(all.map((s) => s.id)).toEqual([second.id, first.id]);
    expect(all[1]?.maskedCpf).toBe('***.982.247-**');
    expect(all[1]?.chosenBank?.bankSlug).toBe('ipe');

    const interested = await simulationService.list({ status: 'INTERESTED' });
    expect(interested.map((s) => s.id)).toEqual([first.id]);
  });

  it('searches by name or CPF digits', async () => {
    const { simulationService, second } = await seeded();
    expect((await simulationService.list({ search: 'bruno' })).map((s) => s.id)).toEqual([
      second.id,
    ]);
    expect((await simulationService.list({ search: '444.777' })).map((s) => s.id)).toEqual([
      second.id,
    ]);
  });

  it('shows details with contact data and masked CPF', async () => {
    const { simulationService, first } = await seeded();
    const details = await simulationService.getDetails(first.id);
    expect(details.customer).toEqual({
      name: 'Ana Souza',
      email: 'ana@exemplo.com',
      phone: '11987650001',
      maskedCpf: '***.982.247-**',
    });
    expect(details.results).toHaveLength(4);
  });

  it('summarizes the day and lists interested customers', async () => {
    const { simulationService, first } = await seeded();
    const overview = await simulationService.overview();
    expect(overview.simulationsToday).toBe(2);
    expect(overview.simulationsYesterday).toBe(0);
    expect(overview.interestedCount).toBe(1);
    expect(overview.interestedToday).toBe(1);
    expect(overview.interested.map((s) => s.id)).toEqual([first.id]);
  });

  it('flags simulations with a failed bank as needing retry', async () => {
    const { simulationService, bankQueryService, provider, second } = await seeded();
    provider('carcara').behavior = () => Promise.reject(new BankIntegrationError('HTTP 503'));
    await bankQueryService.querySimulation(second.id);

    const pending = await simulationService.list({ needsRetry: true });
    expect(pending.map((s) => s.id)).toEqual([second.id]);
    expect(pending[0]?.needsRetry).toBe(true);
    expect((await simulationService.overview()).needsRetryCount).toBe(1);
  });
});

describe('SimulationService.renew', () => {
  it('creates a new valid simulation with the same data', async () => {
    const { simulationService, bankQueryService, store, clock } = setup();
    const { id } = await simulationService.create(validRequest);
    await bankQueryService.querySimulation(id);
    clock.advance(OFFER_TTL_HOURS * HOUR_MS + 1);
    expect((await simulationService.getPublic(id)).status).toBe('EXPIRED');

    const renewed = await simulationService.renew(id);
    expect(renewed.id).not.toBe(id);
    const view = await simulationService.getPublic(renewed.id);
    expect(view.status).toBe('PROCESSING');
    expect(view.requestedAmountCents).toBe(validRequest.requestedAmountCents);
    expect(store.simulations.get(renewed.id)?.customerId).toBe(
      store.simulations.get(id)?.customerId,
    );
    expect(store.resultsOf(renewed.id)).toHaveLength(4);
  });

  it('refuses a simulation that is still valid', async () => {
    const { simulationService } = setup();
    const { id } = await simulationService.create(validRequest);
    await expect(simulationService.renew(id)).rejects.toBeInstanceOf(SimulationStillValidError);
  });

  it('throws NOT_FOUND for an unknown id', async () => {
    const { simulationService } = setup();
    await expect(simulationService.renew('nope')).rejects.toBeInstanceOf(NotFoundError);
  });
});
