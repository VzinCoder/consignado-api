import { ValidationError } from '../errors';
import type { SimulationOrigin } from '../models';
import { isValidCnpj, isValidCpf, onlyDigits } from './documents';
import {
  MAX_AMOUNT_CENTS,
  MAX_SALARY_CENTS,
  MAX_TERM_MONTHS,
  MIN_AMOUNT_CENTS,
  MIN_SALARY_CENTS,
  MIN_TERM_MONTHS,
  CENTS_PER_REAL,
} from './loan';

const MIN_NAME_LETTERS = 3;
const PHONE_LENGTHS = [10, 11];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const brl = (cents: number) =>
  (cents / CENTS_PER_REAL).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export interface LoanTerms {
  salaryCents: number;
  requestedAmountCents: number;
  termMonths: number;
}

export interface SimulationRequest extends LoanTerms {
  name: string;
  email: string;
  phone: string;
  cpf: string;
  employerCnpj: string;
  origin: SimulationOrigin;
}

const inRange = (value: number, min: number, max: number) =>
  Number.isInteger(value) && value >= min && value <= max;

function loanTermErrors(terms: LoanTerms): Record<string, string> {
  const fields: Record<string, string> = {};
  if (!inRange(terms.salaryCents, MIN_SALARY_CENTS, MAX_SALARY_CENTS)) {
    fields.salaryCents = `Informe um salário entre ${brl(MIN_SALARY_CENTS)} e ${brl(MAX_SALARY_CENTS)}.`;
  }
  if (!inRange(terms.requestedAmountCents, MIN_AMOUNT_CENTS, MAX_AMOUNT_CENTS)) {
    fields.requestedAmountCents = `Informe um valor entre ${brl(MIN_AMOUNT_CENTS)} e ${brl(MAX_AMOUNT_CENTS)}.`;
  }
  if (!inRange(terms.termMonths, MIN_TERM_MONTHS, MAX_TERM_MONTHS)) {
    fields.termMonths = `Escolha um prazo entre ${MIN_TERM_MONTHS} e ${MAX_TERM_MONTHS} meses.`;
  }
  return fields;
}

export function validateLoanTerms(terms: LoanTerms): LoanTerms {
  const fields = loanTermErrors(terms);
  if (Object.keys(fields).length > 0) throw new ValidationError(fields);
  return terms;
}

/** Validates and normalizes (trims, keeps only digits) a full simulation request. */
export function validateSimulationRequest(input: SimulationRequest): SimulationRequest {
  const normalized: SimulationRequest = {
    ...input,
    name: input.name.trim().replace(/\s+/g, ' '),
    email: input.email.trim().toLowerCase(),
    phone: onlyDigits(input.phone),
    cpf: onlyDigits(input.cpf),
    employerCnpj: onlyDigits(input.employerCnpj),
  };

  const fields = loanTermErrors(normalized);
  if (normalized.name.replace(/[^\p{L}]/gu, '').length < MIN_NAME_LETTERS) {
    fields.name = 'Informe seu nome completo.';
  }
  if (!EMAIL_PATTERN.test(normalized.email)) fields.email = 'Informe um e-mail válido.';
  if (!PHONE_LENGTHS.includes(normalized.phone.length)) {
    fields.phone = 'Informe um telefone com DDD.';
  }
  if (!isValidCpf(normalized.cpf)) fields.cpf = 'CPF inválido. Confira os números.';
  if (!isValidCnpj(normalized.employerCnpj)) {
    fields.employerCnpj = 'CNPJ inválido. Confira os números.';
  }

  if (Object.keys(fields).length > 0) throw new ValidationError(fields);
  return normalized;
}
