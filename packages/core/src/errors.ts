import { MARGIN_RATIO } from './rules/loan';

const PERCENT = 100;

/** Business errors carry a stable `code`; apps translate them to HTTP in one place. */
export abstract class DomainError extends Error {
  abstract readonly code: string;
}

export class ValidationError extends DomainError {
  readonly code = 'VALIDATION_ERROR';
  constructor(readonly fields: Record<string, string>) {
    super('Alguns dados estão inválidos.');
    this.name = 'ValidationError';
  }
}

export class MarginExceededError extends DomainError {
  readonly code = 'MARGIN_EXCEEDED';
  constructor(
    readonly maxAmountCents: number,
    readonly maxInstallmentCents: number,
  ) {
    super(`A parcela passa de ${Math.round(MARGIN_RATIO * PERCENT)}% do salário.`);
    this.name = 'MarginExceededError';
  }
}

export const SIMULATION_NOT_FOUND = 'Simulação não encontrada.';
export const BANK_RESULT_NOT_FOUND = 'Resposta do banco não encontrada.';

/** Takes the whole sentence, so each entity keeps its own grammar. */
export class NotFoundError extends DomainError {
  readonly code = 'NOT_FOUND';
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class SimulationExpiredError extends DomainError {
  readonly code = 'SIMULATION_EXPIRED';
  constructor() {
    super('Esta simulação expirou. Faça uma nova simulação.');
    this.name = 'SimulationExpiredError';
  }
}

export class SimulationStillValidError extends DomainError {
  readonly code = 'SIMULATION_STILL_VALID';
  constructor() {
    super('Esta simulação ainda está válida. Não é preciso renovar.');
    this.name = 'SimulationStillValidError';
  }
}

export class InterestAlreadyRegisteredError extends DomainError {
  readonly code = 'INTEREST_ALREADY_REGISTERED';
  constructor() {
    super('Você já escolheu uma oferta. Nossa equipe vai falar com você.');
    this.name = 'InterestAlreadyRegisteredError';
  }
}

export class OfferNotAvailableError extends DomainError {
  readonly code = 'OFFER_NOT_AVAILABLE';
  constructor() {
    super('Esta oferta não está disponível.');
    this.name = 'OfferNotAvailableError';
  }
}

export class BankResultNotRetryableError extends DomainError {
  readonly code = 'BANK_RESULT_NOT_RETRYABLE';
  constructor() {
    super('Só é possível reconsultar um banco indisponível.');
    this.name = 'BankResultNotRetryableError';
  }
}

/**
 * Technical failure talking to a bank (timeout, network, 5xx, out-of-contract response).
 * Providers throw it; the core turns it into a FAILED result.
 */
export class BankIntegrationError extends Error {
  constructor(readonly reason: string) {
    super(reason);
    this.name = 'BankIntegrationError';
  }
}

/**
 * Matches a domain error by its stable code. Prefer it over `instanceof` across module boundaries:
 * in Next.js, a server component and the cached container may hold different copies of this module.
 */
export function hasErrorCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}
