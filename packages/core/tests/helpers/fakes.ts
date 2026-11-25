/** In-memory fakes for service tests (no Docker, no network). */
import type {
  BankProvider,
  BankResultRepository,
  Clock,
  CustomerInput,
  CustomerRepository,
  LogContext,
  Logger,
  NewSimulation,
  SimulationListFilter,
  SimulationRepository,
} from '../../src/interfaces';
import type {
  BankQuote,
  BankQuoteRequest,
  BankResult,
  BankResultCompletion,
  Customer,
  Simulation,
  SimulationDetails,
  SimulationWithResults,
} from '../../src/models';
import { onlyDigits } from '../../src/rules/documents';

export class InMemoryStore {
  customers = new Map<string, Customer>();
  simulations = new Map<string, Simulation>();
  results = new Map<string, BankResult>();
  private sequence = 0;

  nextId(prefix: string): string {
    this.sequence += 1;
    return `${prefix}-${this.sequence}`;
  }

  resultsOf(simulationId: string): BankResult[] {
    return [...this.results.values()].filter((r) => r.simulationId === simulationId);
  }
}

export class FakeClock implements Clock {
  constructor(private current: Date = new Date('2026-11-25T12:00:00Z')) {}
  now(): Date {
    return new Date(this.current);
  }
  set(date: Date): void {
    this.current = date;
  }
  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}

export class FakeCustomerRepository implements CustomerRepository {
  constructor(
    private readonly store: InMemoryStore,
    private readonly clock: Clock,
  ) {}

  upsertByCpf(input: CustomerInput): Promise<Customer> {
    const existing = [...this.store.customers.values()].find((c) => c.cpf === input.cpf);
    const now = this.clock.now();
    const customer: Customer = existing
      ? { ...existing, ...input, updatedAt: now }
      : { id: this.store.nextId('customer'), ...input, createdAt: now, updatedAt: now };
    this.store.customers.set(customer.id, customer);
    return Promise.resolve(customer);
  }
}

export class FakeSimulationRepository implements SimulationRepository {
  constructor(private readonly store: InMemoryStore) {}

  create(input: NewSimulation, bankSlugs: string[]): Promise<SimulationWithResults> {
    const simulation: Simulation = {
      id: this.store.nextId('simulation'),
      ...input,
      chosenBankSlug: null,
      interestAt: null,
    };
    this.store.simulations.set(simulation.id, simulation);
    const results = bankSlugs.map((bankSlug) => {
      const result: BankResult = {
        id: this.store.nextId('result'),
        simulationId: simulation.id,
        bankSlug,
        status: 'PENDING',
        offer: null,
        rejectionReason: null,
        failureReason: null,
        startedAt: input.createdAt,
        respondedAt: null,
        durationMs: null,
      };
      this.store.results.set(result.id, result);
      return result;
    });
    return Promise.resolve({ simulation, results });
  }

  findById(id: string): Promise<SimulationWithResults | null> {
    const simulation = this.store.simulations.get(id);
    return Promise.resolve(
      simulation ? { simulation, results: this.store.resultsOf(simulation.id) } : null,
    );
  }

  findDetails(id: string): Promise<SimulationDetails | null> {
    const simulation = this.store.simulations.get(id);
    return Promise.resolve(simulation ? this.details(simulation) : null);
  }

  list(filter: SimulationListFilter): Promise<SimulationDetails[]> {
    const search = filter.search?.trim().toLowerCase();
    const searchDigits = search ? onlyDigits(search) : '';
    const rows = [...this.store.simulations.values()]
      .filter((s) => !filter.createdFrom || s.createdAt >= filter.createdFrom)
      .filter((s) => !filter.onlyWithInterest || s.chosenBankSlug !== null)
      .map((s) => this.details(s))
      .filter(
        (d) =>
          !search ||
          d.customer.name.toLowerCase().includes(search) ||
          (searchDigits !== '' &&
            (d.customer.cpf.includes(searchDigits) || d.customer.phone.includes(searchDigits))),
      )
      .sort((a, b) => b.simulation.createdAt.getTime() - a.simulation.createdAt.getTime());
    return Promise.resolve(rows.slice(0, filter.limit));
  }

  setInterest(id: string, bankSlug: string, at: Date): Promise<Simulation> {
    const simulation = this.store.simulations.get(id);
    if (!simulation) return Promise.reject(new Error(`simulation ${id} not found`));
    const updated = { ...simulation, chosenBankSlug: bankSlug, interestAt: at };
    this.store.simulations.set(id, updated);
    return Promise.resolve(updated);
  }

  private details(simulation: Simulation): SimulationDetails {
    const customer = this.store.customers.get(simulation.customerId);
    if (!customer) throw new Error(`customer ${simulation.customerId} not found`);
    return { simulation, customer, results: this.store.resultsOf(simulation.id) };
  }
}

export class FakeBankResultRepository implements BankResultRepository {
  constructor(private readonly store: InMemoryStore) {}

  findById(id: string): Promise<BankResult | null> {
    return Promise.resolve(this.store.results.get(id) ?? null);
  }

  completeIfPending(id: string, completion: BankResultCompletion): Promise<BankResult | null> {
    const current = this.store.results.get(id);
    if (current?.status !== 'PENDING') return Promise.resolve(null);
    const updated: BankResult = {
      ...current,
      status: completion.status,
      offer: completion.status === 'APPROVED' ? completion.offer : null,
      rejectionReason: completion.status === 'REJECTED' ? completion.reason : null,
      failureReason: completion.status === 'FAILED' ? completion.reason : null,
      respondedAt: completion.respondedAt,
      durationMs: completion.durationMs,
    };
    this.store.results.set(id, updated);
    return Promise.resolve(updated);
  }

  restartIfFailed(id: string, startedAt: Date): Promise<BankResult | null> {
    const current = this.store.results.get(id);
    if (current?.status !== 'FAILED') return Promise.resolve(null);
    const updated: BankResult = {
      ...current,
      status: 'PENDING',
      offer: null,
      rejectionReason: null,
      failureReason: null,
      startedAt,
      respondedAt: null,
      durationMs: null,
    };
    this.store.results.set(id, updated);
    return Promise.resolve(updated);
  }

  failStalePending(
    startedBefore: Date,
    reason: string,
    at: Date,
    simulationId?: string,
  ): Promise<number> {
    let count = 0;
    for (const result of this.store.results.values()) {
      const inScope = !simulationId || result.simulationId === simulationId;
      if (inScope && result.status === 'PENDING' && result.startedAt < startedBefore) {
        this.store.results.set(result.id, {
          ...result,
          status: 'FAILED',
          failureReason: reason,
          respondedAt: at,
        });
        count += 1;
      }
    }
    return Promise.resolve(count);
  }
}

export type FakeBankBehavior = (request: BankQuoteRequest) => Promise<BankQuote>;

export class FakeBankProvider implements BankProvider {
  readonly calls: BankQuoteRequest[] = [];

  constructor(
    readonly slug: string,
    readonly name: string,
    readonly minMonthlyRate: number,
    public behavior: FakeBankBehavior,
  ) {}

  simulate(request: BankQuoteRequest): Promise<BankQuote> {
    this.calls.push(request);
    return this.behavior(request);
  }
}

export function approvingBehavior(monthlyRate: number): FakeBankBehavior {
  return (request) => {
    const installmentCents = Math.round(
      (request.amountCents * monthlyRate) / (1 - (1 + monthlyRate) ** -request.termMonths),
    );
    return Promise.resolve({
      outcome: 'APPROVED',
      offer: {
        monthlyRate,
        approvedAmountCents: request.amountCents,
        installmentCents,
        totalCents: installmentCents * request.termMonths,
        termMonths: request.termMonths,
      },
      raw: { fake: true },
    });
  };
}

export function rejectingBehavior(reason: string): FakeBankBehavior {
  return () => Promise.resolve({ outcome: 'REJECTED', reason, raw: { fake: true } });
}

export interface LogEntry {
  level: 'info' | 'warn' | 'error';
  message: string;
  context: LogContext | undefined;
}

export class FakeLogger implements Logger {
  readonly entries: LogEntry[] = [];
  info(message: string, context?: LogContext): void {
    this.entries.push({ level: 'info', message, context });
  }
  warn(message: string, context?: LogContext): void {
    this.entries.push({ level: 'warn', message, context });
  }
  error(message: string, context?: LogContext): void {
    this.entries.push({ level: 'error', message, context });
  }
}
