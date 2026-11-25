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
    super('A parcela passa de 35% do salário.');
    this.name = 'MarginExceededError';
  }
}

export class NotFoundError extends DomainError {
  readonly code = 'NOT_FOUND';
  constructor(entity: string) {
    super(`${entity} não encontrada.`);
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
