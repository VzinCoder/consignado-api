const CPF_LENGTH = 11;
const CNPJ_LENGTH = 14;
const MOD = 11;

export const onlyDigits = (value: string) => value.replace(/\D/g, '');

const allSameDigit = (digits: string) => /^(\d)\1*$/.test(digits);

function checkDigit(digits: number[], weights: number[]): number {
  const sum = weights.reduce((acc, weight, index) => acc + weight * (digits[index] ?? 0), 0);
  const remainder = sum % MOD;
  return remainder < 2 ? 0 : MOD - remainder;
}

const descending = (from: number, length: number) =>
  Array.from({ length }, (_, index) => from - index);

export function isValidCpf(value: string): boolean {
  const cpf = onlyDigits(value);
  if (cpf.length !== CPF_LENGTH || allSameDigit(cpf)) return false;
  const digits = [...cpf].map(Number);
  const first = checkDigit(digits, descending(10, 9));
  const second = checkDigit(digits, descending(11, 10));
  return digits[9] === first && digits[10] === second;
}

const CNPJ_FIRST_WEIGHTS = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const CNPJ_SECOND_WEIGHTS = [6, ...CNPJ_FIRST_WEIGHTS];

export function isValidCnpj(value: string): boolean {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== CNPJ_LENGTH || allSameDigit(cnpj)) return false;
  const digits = [...cnpj].map(Number);
  const first = checkDigit(digits, CNPJ_FIRST_WEIGHTS);
  const second = checkDigit(digits, CNPJ_SECOND_WEIGHTS);
  return digits[12] === first && digits[13] === second;
}

/** 12345678909 -> ***.456.789-** (mantém apenas os dígitos do meio). */
export function maskCpf(cpf: string): string {
  const digits = onlyDigits(cpf);
  if (digits.length !== CPF_LENGTH) return '***.***.***-**';
  return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
}
