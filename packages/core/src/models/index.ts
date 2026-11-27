/** Valores monetários são sempre centavos inteiros; taxas são decimais mensais (0.0189 = 1,89% a.m.). */

export interface Customer {
  id: string;
  cpf: string;
  name: string;
  email: string;
  phone: string;
  createdAt: Date;
  updatedAt: Date;
}

export type SimulationOrigin = 'CUSTOMER' | 'ADMIN';

export interface Simulation {
  id: string;
  customerId: string;
  employerCnpj: string;
  salaryCents: number;
  requestedAmountCents: number;
  termMonths: number;
  origin: SimulationOrigin;
  chosenBankSlug: string | null;
  interestAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
}

export type BankResultStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'FAILED';

export interface Offer {
  monthlyRate: number;
  approvedAmountCents: number;
  installmentCents: number;
  totalCents: number;
  termMonths: number;
}

export interface BankResult {
  id: string;
  simulationId: string;
  bankSlug: string;
  status: BankResultStatus;
  offer: Offer | null;
  rejectionReason: string | null;
  failureReason: string | null;
  startedAt: Date;
  respondedAt: Date | null;
  durationMs: number | null;
}

export interface SimulationWithResults {
  simulation: Simulation;
  results: BankResult[];
}

export interface SimulationDetails extends SimulationWithResults {
  customer: Customer;
}

/** Calculado na leitura, nunca salvo no banco. */
export type SimulationStatus = 'PROCESSING' | 'COMPLETED' | 'INTERESTED' | 'EXPIRED';

/** O que um banco respondeu, já traduzido pelo seu provider. */
export type BankQuote =
  | { outcome: 'APPROVED'; offer: Offer; raw: unknown }
  | { outcome: 'REJECTED'; reason: string; raw: unknown };

export interface BankQuoteRequest {
  cpf: string;
  salaryCents: number;
  amountCents: number;
  termMonths: number;
}

export type BankResultCompletion =
  | { status: 'APPROVED'; offer: Offer; raw: unknown; respondedAt: Date; durationMs: number }
  | { status: 'REJECTED'; reason: string; raw: unknown; respondedAt: Date; durationMs: number }
  | { status: 'FAILED'; reason: string; raw: unknown; respondedAt: Date; durationMs: number };
