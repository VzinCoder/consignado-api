import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../src/errors';
import {
  validateLoanTerms,
  validateSimulationRequest,
  type SimulationRequest,
} from '../../src/rules/simulation-request';

const validRequest: SimulationRequest = {
  name: '  Ana   Souza ',
  email: 'Ana@Exemplo.com ',
  phone: '(11) 98765-0001',
  cpf: '529.982.247-25',
  employerCnpj: '11.222.333/0001-81',
  salaryCents: 500_000,
  requestedAmountCents: 1_000_000,
  termMonths: 48,
  origin: 'CUSTOMER',
};

function fieldsOf(fn: () => unknown): Record<string, string> {
  try {
    fn();
  } catch (error) {
    if (error instanceof ValidationError) return error.fields;
    throw error;
  }
  return {};
}

describe('validateSimulationRequest', () => {
  it('normalizes a valid request', () => {
    expect(validateSimulationRequest(validRequest)).toMatchObject({
      name: 'Ana Souza',
      email: 'ana@exemplo.com',
      phone: '11987650001',
      cpf: '52998224725',
      employerCnpj: '11222333000181',
    });
  });

  it('reports every invalid field', () => {
    const fields = fieldsOf(() =>
      validateSimulationRequest({
        ...validRequest,
        cpf: '111.111.111-11',
        email: 'nao-e-email',
        phone: '123',
        name: 'A',
        employerCnpj: '1',
      }),
    );
    expect(Object.keys(fields).sort()).toEqual(['cpf', 'email', 'employerCnpj', 'name', 'phone']);
  });
});

describe('validateLoanTerms', () => {
  it('rejects loan terms out of range', () => {
    const fields = fieldsOf(() =>
      validateLoanTerms({ salaryCents: 10, requestedAmountCents: 10, termMonths: 200 }),
    );
    expect(Object.keys(fields).sort()).toEqual([
      'requestedAmountCents',
      'salaryCents',
      'termMonths',
    ]);
  });
});
