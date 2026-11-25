import { describe, expect, it } from 'vitest';
import {
  digitsToCents,
  formatCnpj,
  formatCpf,
  formatMoney,
  formatPhone,
  formatRate,
} from './format';

const WHITESPACE = /\s/g;

describe('format', () => {
  it('formats money and rates in pt-BR', () => {
    expect(formatMoney(623_664).replace(WHITESPACE, ' ')).toBe('R$ 6.236,64');
    expect(formatRate(0.0185)).toBe('1,85% a.m.');
  });

  it('reads typed digits as cents', () => {
    expect(digitsToCents('R$ 3.500,00')).toBe(350_000);
    expect(digitsToCents('')).toBe(0);
  });

  it('masks documents and phone while typing', () => {
    expect(formatCpf('52998224725')).toBe('529.982.247-25');
    expect(formatCpf('5299')).toBe('529.9');
    expect(formatCnpj('11222333000181')).toBe('11.222.333/0001-81');
    expect(formatPhone('87999990000')).toBe('(87) 99999-0000');
  });
});
