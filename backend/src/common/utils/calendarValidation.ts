/**
 * Strict calendar date and academic year validation utility.
 * Guarantees that dates match canonical format and represent actual existing calendar days,
 * handling leap years, variable month lengths, and date-range chronological order.
 */

export interface StrictDateValidationResult {
  valid: boolean;
  year?: number;
  month?: number;
  day?: number;
  isoDate?: string;
  error?: string;
}

/**
 * Checks if a given year is a leap year according to the Gregorian calendar:
 * Divisible by 4, except end-of-century years which must be divisible by 400.
 */
export function isLeapYear(year: number): boolean {
  if (year % 400 === 0) return true;
  if (year % 100 === 0) return false;
  return year % 4 === 0;
}

/**
 * Returns the exact number of days in a calendar month for a given year.
 */
export function getDaysInMonth(year: number, month: number): number {
  if (month < 1 || month > 12) return 0;
  // Months with 30 days: April (4), June (6), September (9), November (11)
  if (month === 4 || month === 6 || month === 9 || month === 11) {
    return 30;
  }
  // February
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }
  // All other months have 31 days
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

/**
 * Validates a YYYY-MM-DD calendar date string strictly.
 * Ensures the date exists, leap years are evaluated, and performs a round-trip validation.
 */
export function validateStrictCalendarDate(dateStr: string): StrictDateValidationResult {
  if (!dateStr || typeof dateStr !== 'string') {
    return { valid: false, error: 'Date string is required.' };
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
    return { valid: false, error: `Year ${year} is outside acceptable calendar range (1900-2100).` };
  }

  if (month < 1 || month > 12) {
    return { valid: false, error: `Month ${month} is invalid. Month must be between 01 and 12.` };
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

  // Round-trip verification using UTC date components
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

/**
 * Validates an ISO datetime string by checking its calendar day and format.
 */
export function validateStrictIsoDateTime(dateTimeStr: string): StrictDateValidationResult {
  if (!dateTimeStr || typeof dateTimeStr !== 'string') {
    return { valid: false, error: 'Datetime string is required.' };
  }

  // Check ISO regex with time component
  const isoRegex = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?)(Z|([+-]\d{2}:\d{2}))?$/;
  const match = isoRegex.exec(dateTimeStr.trim());
  if (!match) {
    return { valid: false, error: 'Must be a valid ISO 8601 datetime string (e.g. YYYY-MM-DDTHH:mm:ss.sssZ).' };
  }

  const datePart = match[1];
  const dateResult = validateStrictCalendarDate(datePart);
  if (!dateResult.valid) {
    return dateResult;
  }

  const parsed = new Date(dateTimeStr);
  if (isNaN(parsed.getTime())) {
    return { valid: false, error: 'Invalid datetime value.' };
  }

  return {
    valid: true,
    year: dateResult.year,
    month: dateResult.month,
    day: dateResult.day,
    isoDate: dateResult.isoDate,
  };
}

/**
 * Validates that an academic year or term date range is chronologically sound:
 * Both dates must be valid calendar dates and start date must precede end date.
 */
export function validateAcademicYearRange(
  startDateStr: string,
  endDateStr: string
): { valid: boolean; error?: string } {
  const startCheck = validateStrictIsoDateTime(startDateStr);
  if (!startCheck.valid) {
    return { valid: false, error: `Invalid start date: ${startCheck.error}` };
  }

  const endCheck = validateStrictIsoDateTime(endDateStr);
  if (!endCheck.valid) {
    return { valid: false, error: `Invalid end date: ${endCheck.error}` };
  }

  const startMs = new Date(startDateStr).getTime();
  const endMs = new Date(endDateStr).getTime();

  if (startMs >= endMs) {
    return {
      valid: false,
      error: 'Academic year start date must precede end date.'
    };
  }

  return { valid: true };
}

export type AcademicYearLifecycle = 'CURRENT' | 'HISTORICAL' | 'UPCOMING';

/**
 * Authoritatively classifies an academic year lifecycle using existing attributes:
 * - 'CURRENT': The officially active school year (is_current === true).
 * - 'HISTORICAL': A finalized, past school year (is_current === false and end_date < referenceDate).
 * - 'UPCOMING': A future school year under administrative preparation (is_current === false and start_date > referenceDate).
 */
export function classifyAcademicYearLifecycle(
  ay: { is_current?: boolean | null; start_date: Date | string; end_date: Date | string },
  referenceDate?: Date
): AcademicYearLifecycle {
  if (ay.is_current) {
    return 'CURRENT';
  }

  // Safety Gate: Controlled clock (APP_TIME) is strictly disabled in production
  // and requires explicit test authorization (ALLOW_TEST_CLOCK === 'true' or NODE_ENV === 'test').
  const isAuthorizedTestEnvironment = process.env.NODE_ENV !== 'production' &&
    (process.env.ALLOW_TEST_CLOCK === 'true' || process.env.NODE_ENV === 'test');

  const effectiveRefDate = referenceDate ||
    (isAuthorizedTestEnvironment && process.env.APP_TIME ? new Date(process.env.APP_TIME) : new Date());

  const endMs = new Date(ay.end_date).getTime();
  const startMs = new Date(ay.start_date).getTime();
  const refMs = effectiveRefDate.getTime();

  if (endMs < refMs) {
    return 'HISTORICAL';
  }
  
  // A non-current year that has not yet concluded (endMs >= refMs) or has startMs > refMs must NOT be historical
  return 'UPCOMING';
}


