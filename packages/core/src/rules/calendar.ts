/** "Hoje" para o negócio é o dia no Brasil, onde quer que o servidor rode (geralmente UTC). */
export const BUSINESS_TIME_ZONE = 'America/Sao_Paulo';

const MS_PER_SECOND = 1000;

/**
 * Início do dia de calendário de `now` em `timeZone`, como um instante absoluto.
 * Usa o deslocamento do fuso em `now` (o Brasil não tem horário de verão desde 2019).
 */
export function startOfDay(now: Date, timeZone: string): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);

  const year = part('year');
  const monthIndex = part('month') - 1;
  const day = part('day');
  const wallClockAsUtc = Date.UTC(
    year,
    monthIndex,
    day,
    part('hour'),
    part('minute'),
    part('second'),
  );
  const offsetMs = wallClockAsUtc - Math.floor(now.getTime() / MS_PER_SECOND) * MS_PER_SECOND;
  return new Date(Date.UTC(year, monthIndex, day) - offsetMs);
}
