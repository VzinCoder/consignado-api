/** "Today" for the business is the day in Brazil, wherever the server runs (often UTC). */
export const BUSINESS_TIME_ZONE = 'America/Sao_Paulo';

const MS_PER_SECOND = 1000;

/**
 * Start of the calendar day of `now` in `timeZone`, as an absolute instant.
 * Uses the zone offset at `now` (Brazil has no daylight saving time since 2019).
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
