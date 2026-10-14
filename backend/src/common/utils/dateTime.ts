/**
 * Date and Time utilities for DigiSkwela.
 * Authoritative school timezone: Asia/Manila (UTC+8).
 */

export interface PhilippineCalendarDate {
  year: number;
  month: number; // 1-12
  day: number;   // 1-31
  dateStr: string; // 'YYYY-MM-DD'
  dateObj: Date;   // midnight UTC Date representing the @db.Date in Prisma
}

/**
 * Extracts school-local calendar year, month, and day in Asia/Manila using formatToParts().
 * Guarantees 100% independence from host/server OS timezone.
 */
export function getPhilippineCalendarDate(instant: Date = new Date()): PhilippineCalendarDate {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });

  const parts = formatter.formatToParts(instant);
  let year = 1970;
  let month = 1;
  let day = 1;

  for (const part of parts) {
    if (part.type === 'year') year = parseInt(part.value, 10);
    if (part.type === 'month') month = parseInt(part.value, 10);
    if (part.type === 'day') day = parseInt(part.value, 10);
  }

  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  const dateStr = `${year}-${mm}-${dd}`;
  const dateObj = new Date(Date.UTC(year, month - 1, day));

  return { year, month, day, dateStr, dateObj };
}

/**
 * Parses a YYYY-MM-DD string into a midnight UTC Date for querying @db.Date in Prisma.
 */
export function parseCalendarDate(dateStr: string): Date {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new Error('Invalid date format. Expected YYYY-MM-DD');
  }
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Formats an instant as hh:mm A in Asia/Manila (e.g., '07:48 AM').
 */
export function formatManilaTime(instant: Date | string | null | undefined): string | null {
  if (!instant) return null;
  const d = typeof instant === 'string' ? new Date(instant) : instant;
  if (isNaN(d.getTime())) return null;

  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(d);
}
