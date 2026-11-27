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
  /** Cria o cliente ou atualiza seus dados de contato quando o CPF já existe. */
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
  /** Busca pelo nome do cliente (sem diferenciar maiúsculas/minúsculas), ou dígitos de CPF ou telefone. */
  search?: string;
  createdFrom?: Date;
  onlyWithInterest?: boolean;
  limit: number;
}

export interface SimulationRepository {
  /** Cria a simulação e um resultado PENDING por slug de banco, de forma atômica. */
  create(input: NewSimulation, bankSlugs: string[]): Promise<SimulationWithResults>;
  findById(id: string): Promise<SimulationWithResults | null>;
  findDetails(id: string): Promise<SimulationDetails | null>;
  /** Mais recentes primeiro. */
  list(filter: SimulationListFilter): Promise<SimulationDetails[]>;
  setInterest(id: string, bankSlug: string, at: Date): Promise<Simulation>;
}

export interface BankResultRepository {
  findById(id: string): Promise<BankResult | null>;
  /** Grava o resultado somente se ainda estiver PENDING. Caso contrário, retorna null. */
  completeIfPending(id: string, completion: BankResultCompletion): Promise<BankResult | null>;
  /** Volta um resultado FAILED para PENDING. Retorna null se não estava FAILED. */
  restartIfFailed(id: string, startedAt: Date): Promise<BankResult | null>;
  /**
   * Marca resultados PENDING iniciados antes de `startedBefore` como FAILED (somente os de `simulationId`
   * quando informado). Retorna quantos foram atualizados.
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
  /** Menor taxa mensal que este banco oferece; usada no pré-filtro de margem. */
  readonly minMonthlyRate: number;
  /** Lança BankIntegrationError em falha técnica (timeout, rede, 5xx, resposta fora do contrato). */
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
