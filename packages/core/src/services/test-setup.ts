import type { SimulationRequest } from '../rules/simulation-request';
import {
  FakeBankProvider,
  FakeBankResultRepository,
  FakeClock,
  FakeCustomerRepository,
  FakeLogger,
  FakeSimulationRepository,
  InMemoryStore,
  approvingBehavior,
} from '../testing';
import { BankQueryService } from './bank-query.service';
import { SimulationService } from './simulation.service';

export const BANK_TIMEOUT_MS = 5000;
export const OFFER_TTL_HOURS = 72;

export const validRequest: SimulationRequest = {
  name: 'Ana Souza',
  email: 'ana@exemplo.com',
  phone: '11987650001',
  cpf: '52998224725',
  employerCnpj: '11222333000181',
  salaryCents: 500_000,
  requestedAmountCents: 1_000_000,
  termMonths: 48,
  origin: 'CUSTOMER',
};

export function setup() {
  const store = new InMemoryStore();
  const clock = new FakeClock();
  const logger = new FakeLogger();
  const providers = [
    new FakeBankProvider('ipe', 'Ipê Bank', 0.0169, approvingBehavior(0.018)),
    new FakeBankProvider('mandacaru', 'Banco Mandacaru', 0.0155, approvingBehavior(0.016)),
    new FakeBankProvider('jangada', 'Jangada Crédito', 0.0179, approvingBehavior(0.019)),
    new FakeBankProvider('carcara', 'Carcará Financeira', 0.0199, approvingBehavior(0.022)),
  ];
  const customers = new FakeCustomerRepository(store, clock);
  const simulations = new FakeSimulationRepository(store);
  const bankResults = new FakeBankResultRepository(store);

  const simulationService = new SimulationService({
    customers,
    simulations,
    bankResults,
    providers,
    clock,
    config: { offerTtlHours: OFFER_TTL_HOURS, bankTimeoutMs: BANK_TIMEOUT_MS },
  });
  const bankQueryService = new BankQueryService({
    simulations,
    bankResults,
    providers,
    clock,
    logger,
  });

  const provider = (slug: string) => {
    const found = providers.find((p) => p.slug === slug);
    if (!found) throw new Error(`provider ${slug} not found`);
    return found;
  };

  return { store, clock, logger, providers, provider, simulationService, bankQueryService };
}
