import {
  SIMULATION_NOT_FOUND,
  InterestAlreadyRegisteredError,
  MarginExceededError,
  NotFoundError,
  OfferNotAvailableError,
  SimulationExpiredError,
  SimulationStillValidError,
} from '../errors';
import type {
  BankProvider,
  BankResultRepository,
  Clock,
  CustomerRepository,
  SimulationRepository,
} from '../interfaces';
import type { SimulationStatus } from '../models';
import { BUSINESS_TIME_ZONE, startOfDay as startOfDayIn } from '../rules/calendar';
import { checkMargin, type MarginCheck } from '../rules/loan';
import {
  STALE_FAILURE_REASON,
  expiresAt,
  isApproved,
  isExpired,
  staleCutoff,
} from '../rules/simulation';
import {
  validateLoanTerms,
  validateSimulationRequest,
  type LoanTerms,
  type SimulationRequest,
} from '../rules/simulation-request';
import {
  ViewBuilder,
  type AdminSimulationSummary,
  type AdminSimulationView,
  type PublicSimulationView,
} from './views';

export const ADMIN_LIST_LIMIT = 200;

export interface SimulationServiceConfig {
  offerTtlHours: number;
  bankTimeoutMs: number;
}

export interface SimulationServiceDeps {
  customers: CustomerRepository;
  simulations: SimulationRepository;
  bankResults: BankResultRepository;
  providers: BankProvider[];
  clock: Clock;
  config: SimulationServiceConfig;
}

export interface AdminListFilter {
  status?: SimulationStatus;
  /** true: only simulations with a FAILED bank to retry; false: only those without. */
  needsRetry?: boolean;
  search?: string;
}

export interface AdminOverview {
  simulationsToday: number;
  simulationsYesterday: number;
  /** Customers with a chosen offer (they stay leads even after the offer validity). */
  interestedCount: number;
  interestedToday: number;
  /** Valid simulations with at least one FAILED bank. */
  needsRetryCount: number;
  interested: AdminSimulationSummary[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

export class SimulationService {
  private readonly views: ViewBuilder;

  constructor(private readonly deps: SimulationServiceDeps) {
    this.views = new ViewBuilder(deps.providers);
  }

  /** Lowest rate among all banks: if the installment doesn't fit even with it, no bank approves. */
  private lowestRate(): number {
    return Math.min(...this.deps.providers.map((p) => p.minMonthlyRate));
  }

  checkMargin(terms: LoanTerms): MarginCheck {
    const valid = validateLoanTerms(terms);
    return checkMargin(
      valid.salaryCents,
      valid.requestedAmountCents,
      valid.termMonths,
      this.lowestRate(),
    );
  }

  async create(input: SimulationRequest): Promise<{ id: string }> {
    const request = validateSimulationRequest(input);
    const margin = this.checkMargin(request);
    if (!margin.fits) {
      throw new MarginExceededError(margin.maxAmountCents, margin.maxInstallmentCents);
    }

    const customer = await this.deps.customers.upsertByCpf({
      cpf: request.cpf,
      name: request.name,
      email: request.email,
      phone: request.phone,
    });

    const now = this.deps.clock.now();
    const { simulation } = await this.deps.simulations.create(
      {
        customerId: customer.id,
        employerCnpj: request.employerCnpj,
        salaryCents: request.salaryCents,
        requestedAmountCents: request.requestedAmountCents,
        termMonths: request.termMonths,
        origin: request.origin,
        createdAt: now,
        expiresAt: expiresAt(now, this.deps.config.offerTtlHours),
      },
      this.deps.providers.map((p) => p.slug),
    );
    return { id: simulation.id };
  }

  /** Creates a fresh simulation with the same customer and loan data (e.g. after expiration). */
  async renew(id: string): Promise<{ id: string }> {
    const previous = await this.deps.simulations.findById(id);
    if (!previous) throw new NotFoundError(SIMULATION_NOT_FOUND);
    const { simulation } = previous;

    const now = this.deps.clock.now();
    if (!isExpired(simulation, now)) throw new SimulationStillValidError();
    const created = await this.deps.simulations.create(
      {
        customerId: simulation.customerId,
        employerCnpj: simulation.employerCnpj,
        salaryCents: simulation.salaryCents,
        requestedAmountCents: simulation.requestedAmountCents,
        termMonths: simulation.termMonths,
        origin: simulation.origin,
        createdAt: now,
        expiresAt: expiresAt(now, this.deps.config.offerTtlHours),
      },
      this.deps.providers.map((p) => p.slug),
    );
    return { id: created.simulation.id };
  }

  /**
   * Stuck PENDING results (server restarted mid-query) become FAILED before any read.
   * Reading one simulation only touches its own results; admin lists release all of them.
   */
  private async releaseStalePending(simulationId?: string): Promise<Date> {
    const now = this.deps.clock.now();
    await this.deps.bankResults.failStalePending(
      staleCutoff(now, this.deps.config.bankTimeoutMs),
      STALE_FAILURE_REASON,
      now,
      simulationId,
    );
    return now;
  }

  async getPublic(id: string): Promise<PublicSimulationView> {
    const now = await this.releaseStalePending(id);
    const details = await this.deps.simulations.findDetails(id);
    if (!details) throw new NotFoundError(SIMULATION_NOT_FOUND);
    return this.views.publicView(details, details.customer.name, now);
  }

  async registerInterest(id: string, bankSlug: string): Promise<PublicSimulationView> {
    const now = await this.releaseStalePending(id);
    const details = await this.deps.simulations.findDetails(id);
    if (!details) throw new NotFoundError(SIMULATION_NOT_FOUND);
    if (isExpired(details.simulation, now)) throw new SimulationExpiredError();

    const result = details.results.find((r) => r.bankSlug === bankSlug);
    if (!result || !isApproved(result)) throw new OfferNotAvailableError();

    const { chosenBankSlug } = details.simulation;
    if (chosenBankSlug === bankSlug) {
      return this.views.publicView(details, details.customer.name, now);
    }
    if (chosenBankSlug) throw new InterestAlreadyRegisteredError();

    const simulation = await this.deps.simulations.setInterest(id, bankSlug, now);
    return this.views.publicView({ ...details, simulation }, details.customer.name, now);
  }

  async list(filter: AdminListFilter = {}): Promise<AdminSimulationSummary[]> {
    const now = await this.releaseStalePending();
    const rows = await this.deps.simulations.list({
      search: filter.search,
      limit: ADMIN_LIST_LIMIT,
    });
    return rows
      .map((row) => this.views.summary(row, now))
      .filter((s) => !filter.status || s.status === filter.status)
      .filter((s) => filter.needsRetry === undefined || s.needsRetry === filter.needsRetry);
  }

  async getDetails(id: string): Promise<AdminSimulationView> {
    const now = await this.releaseStalePending(id);
    const details = await this.deps.simulations.findDetails(id);
    if (!details) throw new NotFoundError(SIMULATION_NOT_FOUND);
    return this.views.adminView(details, now);
  }

  async overview(): Promise<AdminOverview> {
    const now = await this.releaseStalePending();
    const startOfDay = startOfDayIn(now, BUSINESS_TIME_ZONE);

    const startOfYesterday = new Date(startOfDay.getTime() - DAY_MS);

    const recent = await this.deps.simulations.list({
      createdFrom: startOfYesterday,
      limit: ADMIN_LIST_LIMIT,
    });
    const withInterest = await this.deps.simulations.list({
      onlyWithInterest: true,
      limit: ADMIN_LIST_LIMIT,
    });
    const latest = await this.deps.simulations.list({ limit: ADMIN_LIST_LIMIT });

    const interested = withInterest
      .map((row) => this.views.summary(row, now))
      .filter((s) => s.status === 'INTERESTED')
      .sort((a, b) => (b.interestAt?.getTime() ?? 0) - (a.interestAt?.getTime() ?? 0));
    const simulationsToday = recent.filter((d) => d.simulation.createdAt >= startOfDay).length;

    return {
      simulationsToday,
      simulationsYesterday: recent.length - simulationsToday,
      interestedCount: interested.length,
      interestedToday: interested.filter((s) => s.interestAt && s.interestAt >= startOfDay).length,
      needsRetryCount: latest.filter((row) => this.views.summary(row, now).needsRetry).length,
      interested,
    };
  }
}
