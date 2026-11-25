import { BUSINESS_TIME_ZONE } from '@zelafin/core';

const CENTS_PER_REAL = 100;
const PERCENT = 100;

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export const formatMoney = (cents: number) => brl.format(cents / CENTS_PER_REAL);

/** 0.0185 -> "1,85% a.m." */
export const formatRate = (rate: number) =>
  `${(rate * PERCENT).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% a.m.`;

/** Money input: typed digits are cents ("350000" -> R$ 3.500,00). */
export const digitsToCents = (value: string) => Number(value.replace(/\D/g, '') || '0');

export const onlyDigits = (value: string) => value.replace(/\D/g, '');

export function formatCpf(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
}

export function formatCnpj(value: string): string {
  const d = onlyDigits(value).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

export function formatPhone(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

// Dates always in Brazil time, so server and browser render the same text.
const shortDate = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'short',
  timeZone: BUSINESS_TIME_ZONE,
});
export const formatShortDate = (iso: string) => shortDate.format(new Date(iso)).replace('.', '');

const dateTime = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: BUSINESS_TIME_ZONE,
});
export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));

export const TERM_OPTIONS = [12, 24, 36, 48, 60, 72, 84, 96] as const;

const MINUTE_MS = 60_000;
const HOUR_MINUTES = 60;
const DAY_HOURS = 24;

/** "agora", "há 25 min", "há 3 h", "há 2 dias". */
export function formatRelative(date: Date, now: Date = new Date()): string {
  const minutes = Math.floor((now.getTime() - date.getTime()) / MINUTE_MS);
  if (minutes < 1) return 'agora';
  if (minutes < HOUR_MINUTES) return `há ${minutes} min`;
  const hours = Math.floor(minutes / HOUR_MINUTES);
  if (hours < DAY_HOURS) return `há ${hours} h`;
  const days = Math.floor(hours / DAY_HOURS);
  return days === 1 ? 'há 1 dia' : `há ${days} dias`;
}

const timeOnly = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: BUSINESS_TIME_ZONE,
});
export const formatTime = (date: Date) => timeOnly.format(date);
