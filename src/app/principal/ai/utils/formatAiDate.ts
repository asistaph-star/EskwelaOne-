const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

/**
 * Checks if a string looks like a standard ISO date (YYYY-MM-DD)
 */
export function isIsoDateOnly(str: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(str.trim());
}

/**
 * Checks if a string looks like an ISO date with time (YYYY-MM-DDTHH:mm or YYYY-MM-DD HH:mm)
 */
export function isIsoDateTime(str: string): boolean {
  return /^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}(:\d{2})?/.test(str.trim());
}

/**
 * Parses YYYY-MM-DD into [year, month (1-12), day] without timezone offset shifts.
 */
function parseYmd(ymd: string): [number, number, number] | null {
  const match = ymd.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)];
}

/**
 * Formats a single date YYYY-MM-DD into readable form: "Oct 14, 2026"
 */
export function formatSingleDate(ymd: string): string {
  const parsed = parseYmd(ymd);
  if (!parsed) return ymd;
  const [y, m, d] = parsed;
  if (m < 1 || m > 12) return ymd;
  return `${MONTH_NAMES[m - 1]} ${d}, ${y}`;
}

/**
 * Formats a date range cleanly:
 * - Same date: "Oct 14, 2026"
 * - Same month: "Jun 10–14, 2026"
 * - Different month: "May 28 – Jun 2, 2026"
 * - Different year: "Dec 28, 2025 – Jan 4, 2026"
 */
export function formatDateRange(startDate?: string, endDate?: string, daysCount?: number): string {
  if (!startDate) return endDate ? formatSingleDate(endDate) : 'N/A';
  if (!endDate || startDate === endDate) {
    const single = formatSingleDate(startDate);
    return daysCount && daysCount > 1 ? `${single} (${daysCount} days)` : single;
  }

  const pStart = parseYmd(startDate);
  const pEnd = parseYmd(endDate);

  if (!pStart || !pEnd) {
    return `${startDate} to ${endDate}`;
  }

  const [y1, m1, d1] = pStart;
  const [y2, m2, d2] = pEnd;

  let rangeText = '';
  if (y1 === y2) {
    if (m1 === m2) {
      rangeText = `${MONTH_NAMES[m1 - 1]} ${d1}–${d2}, ${y1}`;
    } else {
      rangeText = `${MONTH_NAMES[m1 - 1]} ${d1} – ${MONTH_NAMES[m2 - 1]} ${d2}, ${y1}`;
    }
  } else {
    rangeText = `${MONTH_NAMES[m1 - 1]} ${d1}, ${y1} – ${MONTH_NAMES[m2 - 1]} ${d2}, ${y2}`;
  }

  return rangeText;
}

/**
 * Formats an ISO datetime string into readable: "Oct 14, 2026 · 3:02 PM"
 */
export function formatDateTime(isoStr: string): string {
  const match = isoStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(:(\d{2}))?/);
  if (!match) return isoStr;

  const y = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const d = parseInt(match[3], 10);
  let hr = parseInt(match[4], 10);
  const min = match[5];

  if (m < 1 || m > 12) return isoStr;

  const ampm = hr >= 12 ? 'PM' : 'AM';
  hr = hr % 12;
  if (hr === 0) hr = 12;

  return `${MONTH_NAMES[m - 1]} ${d}, ${y} · ${hr}:${min} ${ampm}`;
}

/**
 * Universal date/time formatter for assistant outputs:
 * Converts raw timestamps or date ranges into polished, human-friendly formats.
 */
export function formatAiDate(val: string): string {
  if (!val || typeof val !== 'string') return val;
  const trimmed = val.trim();

  // Range syntax like "2026-10-14 -> 2026-10-14" or "2026-10-14 to 2026-10-14"
  const rangeMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})\s*(?:->|to|–|-)\s*(\d{4}-\d{2}-\d{2})$/);
  if (rangeMatch) {
    return formatDateRange(rangeMatch[1], rangeMatch[2]);
  }

  if (isIsoDateTime(trimmed)) {
    return formatDateTime(trimmed);
  }

  if (isIsoDateOnly(trimmed)) {
    return formatSingleDate(trimmed);
  }

  return val;
}
