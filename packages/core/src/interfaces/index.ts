import type {
  BankQuote,
  BankQuoteRequest,
  BankResult,
  BankResultCompletion,
  Customer,
  Simulation,
  SimulationDetails,
  SimulationOrigin,
  SimulationWithResults,
} from '../models';

export interface CustomerInput {
  cpf: string;
  name: string;
  email: string;
  phone: string;
}

export interface CustomerRepository {
  /** Creates the customer or updates its contact data when the CPF already exists. */
  upsertByCpf(input: CustomerInput): Promise<Customer>;
}

export interface NewSimulation {
  customerId: string;
  employerCnpj: string;
  salaryCents: number;
  requestedAmountCents: number;
  termMonths: number;
  origin: SimulationOrigin;
  expiresAt: Date;
  createdAt: Date;
}

export interface SimulationListFilter {
  /** Matches customer name (case-insensitive), or CPF or phone digits. */
  search?: string;
  createdFrom?: Date;
  onlyWithInterest?: boolean;
  limit: number;
}

export interface SimulationRepository {
  /** Creates the simulation and one PENDING result per bank slug, atomically. */
  create(input: NewSimulation, bankSlugs: string[]): Promise<SimulationWithResults>;
  findById(id: string): Promise<SimulationWithResults | null>;
  findDetails(id: string): Promise<SimulationDetails | null>;
  /** Most recent first. */
  list(filter: SimulationListFilter): Promise<SimulationDetails[]>;
  setInterest(id: string, bankSlug: string, at: Date): Promise<Simulation>;
}

export interface BankResultRepository {
  findById(id: string): Promise<BankResult | null>;
  /** Stores the outcome only if the result is still PENDING. Returns null otherwise. */
  completeIfPending(id: string, completion: BankResultCompletion): Promise<BankResult | null>;
  /** Moves a FAILED result back to PENDING. Returns null if it was not FAILED. */
  restartIfFailed(id: string, startedAt: Date): Promise<BankResult | null>;
  /**
   * Marks PENDING results started before `startedBefore` as FAILED (only those of `simulationId`
   * when given). Returns how many.
   */
  failStalePending(
    startedBefore: Date,
    reason: string,
    at: Date,
    simulationId?: string,
  ): Promise<number>;
}

export interface BankProvider {
  readonly slug: string;
  readonly name: string;
  /** Lowest monthly rate this bank offers; used by the margin pre-filter. */
  readonly minMonthlyRate: number;
  /** Throws BankIntegrationError on technical failure (timeout, network, 5xx, bad contract). */
  simulate(request: BankQuoteRequest): Promise<BankQuote>;
}

export type LogContext = Record<string, string | number | boolean | null | undefined>;

export interface Logger {
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
}

export interface Clock {
  now(): Date;
}
