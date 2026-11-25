import { describe, expect, it } from 'vitest';
import { isValidCnpj, isValidCpf, maskCpf } from '../../src/rules/documents';

describe('documents', () => {
  it('validates CPF check digits', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true);
    expect(isValidCpf('52998224724')).toBe(false);
    expect(isValidCpf('111.111.111-11')).toBe(false);
    expect(isValidCpf('123')).toBe(false);
  });

  it('validates CNPJ check digits', () => {
    expect(isValidCnpj('11.222.333/0001-81')).toBe(true);
    expect(isValidCnpj('11222333000182')).toBe(false);
    expect(isValidCnpj('00000000000000')).toBe(false);
  });

  it('masks the CPF keeping the middle digits', () => {
    expect(maskCpf('12345678909')).toBe('***.456.789-**');
  });
});
