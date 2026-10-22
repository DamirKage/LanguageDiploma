import { DateTime } from 'luxon';

export function isValidTimezone(tz: string): boolean {
  return DateTime.now().setZone(tz).isValid;
}

function zoned(date: Date, tz: string): DateTime {
  const dt = DateTime.fromJSDate(date).setZone(tz);
  return dt.isValid ? dt : DateTime.fromJSDate(date).setZone('UTC');
}

/** Calendar date (YYYY-MM-DD) of an instant in the learner's time zone. */
export function localDateKey(date: Date, tz: string): string {
  return zoned(date, tz).toISODate()!;
}

export function startOfLocalDay(date: Date, tz: string): Date {
  return zoned(date, tz).startOf('day').toJSDate();
}

export function endOfLocalDay(date: Date, tz: string): Date {
  return zoned(date, tz).endOf('day').toJSDate();
}

/** Start of the local day `days` calendar days after `date`, robust to DST transitions. */
export function addLocalDays(date: Date, days: number, tz: string): Date {
  return zoned(date, tz).startOf('day').plus({ days }).toJSDate();
}

/** Whole calendar days between two instants, measured in the learner's time zone. */
export function localDaysBetween(from: Date, to: Date, tz: string): number {
  const a = zoned(from, tz).startOf('day');
  const b = zoned(to, tz).startOf('day');
  return Math.round(b.diff(a, 'days').days);
}

export function lastLocalDates(now: Date, count: number, tz: string): string[] {
  const end = zoned(now, tz).startOf('day');
  return Array.from({ length: count }, (_, i) => end.minus({ days: count - 1 - i }).toISODate()!);
}

export const DAY_MS = 86_400_000;
