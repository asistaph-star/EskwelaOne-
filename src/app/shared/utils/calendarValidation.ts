/**
 * Frontend strict calendar date validation utility matching backend rules.
 */

export interface StrictDateValidationResult {
  valid: boolean;
  year?: number;
  month?: number;
  day?: number;
  isoDate?: string;
  error?: string;
}

export function isLeapYear(year: number): boolean {
  if (year % 400 === 0) return true;
  if (year % 100 === 0) return false;
  return year % 4 === 0;
}

export function getDaysInMonth(year: number, month: number): number {
  if (month < 1 || month > 12) return 0;
  if (month === 4 || month === 6 || month === 9 || month === 11) {
    return 30;
  }
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }
  return 31;
}

const MONTH_NAMES = [
  '',
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
];

export function validateStrictCalendarDate(dateStr: string): StrictDateValidationResult {
  if (!dateStr || typeof dateStr !== 'string') {
    return { valid: false, error: 'Date is required.' };
  }

  const trimmed = dateStr.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) {
    return { valid: false, error: 'Date must follow YYYY-MM-DD format.' };
  }

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  if (year < 1900 || year > 2100) {
    return { valid: false, error: `Year ${year} is outside acceptable range (1900-2100).` };
  }

  if (month < 1 || month > 12) {
    return { valid: false, error: `Month ${month} is invalid.` };
  }

  const maxDays = getDaysInMonth(year, month);
  if (day < 1 || day > maxDays) {
    if (month === 2) {
      if (day === 29 && !isLeapYear(year)) {
        return {
          valid: false,
          error: `February 29 does not exist in non-leap year ${year}.`
        };
      }
      return {
        valid: false,
        error: `February has only ${maxDays} days in ${year}. Day ${day} is invalid.`
      };
    }
    return {
      valid: false,
      error: `${MONTH_NAMES[month]} has only ${maxDays} days in ${year}. Day ${day} is invalid.`
    };
  }

  const utcDate = new Date(Date.UTC(year, month - 1, day));
  if (
    utcDate.getUTCFullYear() !== year ||
    utcDate.getUTCMonth() + 1 !== month ||
    utcDate.getUTCDate() !== day
  ) {
    return { valid: false, error: `Date ${dateStr} is not a valid calendar day.` };
  }

  const canonical = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return {
    valid: true,
    year,
    month,
    day,
    isoDate: canonical,
  };
}

