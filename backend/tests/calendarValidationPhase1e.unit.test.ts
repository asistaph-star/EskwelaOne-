import { describe, it, expect } from 'vitest';
import {
  isLeapYear,
  getDaysInMonth,
  validateStrictCalendarDate,
  validateStrictIsoDateTime,
  validateAcademicYearRange,
} from '../src/common/utils/calendarValidation.js';
import {
  createAcademicYearSchema,
  addAcademicTermSchema,
} from '../src/academic/academic.service.js';

describe('DigiSkwela — Phase 1E: Academic Year & School Calendar Data Integrity', () => {

  describe('1. Leap Year & Days-in-Month Calculation Rules', () => {
    it('correctly identifies leap years according to DepEd & Gregorian calendar rules', () => {
      // Quadrennial leap years
      expect(isLeapYear(2024)).toBe(true);
      expect(isLeapYear(2028)).toBe(true);
      expect(isLeapYear(2032)).toBe(true);

      // Centenary rules: divisible by 400 is leap, divisible by 100 only is NOT leap
      expect(isLeapYear(2000)).toBe(true);
      expect(isLeapYear(2400)).toBe(true);
      expect(isLeapYear(1900)).toBe(false);
      expect(isLeapYear(2100)).toBe(false);

      // Standard non-leap years
      expect(isLeapYear(2025)).toBe(false);
      expect(isLeapYear(2026)).toBe(false);
      expect(isLeapYear(2027)).toBe(false);
    });

    it('returns exact days in month for February in leap vs non-leap years', () => {
      expect(getDaysInMonth(2024, 2)).toBe(29);
      expect(getDaysInMonth(2028, 2)).toBe(29);
      expect(getDaysInMonth(2000, 2)).toBe(29);

      expect(getDaysInMonth(2025, 2)).toBe(28);
      expect(getDaysInMonth(2026, 2)).toBe(28);
      expect(getDaysInMonth(2027, 2)).toBe(28);
      expect(getDaysInMonth(1900, 2)).toBe(28);
      expect(getDaysInMonth(2100, 2)).toBe(28);
    });

    it('returns exact days for 30-day and 31-day months', () => {
      // 31-day months: 1, 3, 5, 7, 8, 10, 12
      [1, 3, 5, 7, 8, 10, 12].forEach((m) => {
        expect(getDaysInMonth(2026, m)).toBe(31);
      });

      // 30-day months: 4, 6, 9, 11
      [4, 6, 9, 11].forEach((m) => {
        expect(getDaysInMonth(2026, m)).toBe(30);
      });
    });
  });

  describe('2. Strict Calendar Day Date Validation (validateStrictCalendarDate)', () => {
    it('accepts valid calendar dates across regular months', () => {
      expect(validateStrictCalendarDate('2026-06-01').valid).toBe(true);
      expect(validateStrictCalendarDate('2026-10-31').valid).toBe(true);
      expect(validateStrictCalendarDate('2026-12-25').valid).toBe(true);
      expect(validateStrictCalendarDate('2027-01-01').valid).toBe(true);
      expect(validateStrictCalendarDate('2027-04-30').valid).toBe(true);
    });

    it('accepts February 29 for valid leap years (2024, 2028, 2000)', () => {
      expect(validateStrictCalendarDate('2024-02-29').valid).toBe(true);
      expect(validateStrictCalendarDate('2028-02-29').valid).toBe(true);
      expect(validateStrictCalendarDate('2000-02-29').valid).toBe(true);
    });

    it('rejects February 29 for common (non-leap) years (2026, 2025, 1900, 2100)', () => {
      const res2026 = validateStrictCalendarDate('2026-02-29');
      expect(res2026.valid).toBe(false);
      expect(res2026.error).toMatch(/February 29 does not exist in non-leap year 2026/i);

      const res2025 = validateStrictCalendarDate('2025-02-29');
      expect(res2025.valid).toBe(false);

      const res1900 = validateStrictCalendarDate('1900-02-29');
      expect(res1900.valid).toBe(false);
    });

    it('rejects impossible dates like February 30 and February 31', () => {
      const res30 = validateStrictCalendarDate('2026-02-30');
      expect(res30.valid).toBe(false);
      expect(res30.error).toMatch(/February has only 28 days in 2026/i);

      const res31 = validateStrictCalendarDate('2026-02-31');
      expect(res31.valid).toBe(false);
      expect(res31.error).toMatch(/February has only 28 days in 2026/i);
    });

    it('rejects day 31 in 30-day months (April, June, September, November)', () => {
      expect(validateStrictCalendarDate('2026-04-31').valid).toBe(false);
      expect(validateStrictCalendarDate('2026-06-31').valid).toBe(false);
      expect(validateStrictCalendarDate('2026-09-31').valid).toBe(false);
      expect(validateStrictCalendarDate('2026-11-31').valid).toBe(false);
    });

    it('rejects malformed, non-canonical, or out-of-range dates', () => {
      expect(validateStrictCalendarDate('2026-00-15').valid).toBe(false);
      expect(validateStrictCalendarDate('2026-13-01').valid).toBe(false);
      expect(validateStrictCalendarDate('2026-01-00').valid).toBe(false);
      expect(validateStrictCalendarDate('2026-01-32').valid).toBe(false);
      expect(validateStrictCalendarDate('2026/02/15').valid).toBe(false);
      expect(validateStrictCalendarDate('02-15-2026').valid).toBe(false);
      expect(validateStrictCalendarDate('not-a-date').valid).toBe(false);
      expect(validateStrictCalendarDate('').valid).toBe(false);
    });
  });

  describe('3. Strict ISO Datetime Validation (validateStrictIsoDateTime)', () => {
    it('accepts valid ISO datetimes with correct calendar days', () => {
      expect(validateStrictIsoDateTime('2026-06-01T00:00:00.000Z').valid).toBe(true);
      expect(validateStrictIsoDateTime('2028-02-29T12:00:00Z').valid).toBe(true);
      expect(validateStrictIsoDateTime('2026-11-15T08:30:00+08:00').valid).toBe(true);
    });

    it('rejects ISO datetimes containing impossible calendar days that would silently roll over in Date.parse', () => {
      // 2026-02-31 rolls over to March 3 in Date.parse
      const feb31 = validateStrictIsoDateTime('2026-02-31T00:00:00.000Z');
      expect(feb31.valid).toBe(false);

      // 2026-02-29 rolls over to March 1 in Date.parse
      const feb29 = validateStrictIsoDateTime('2026-02-29T00:00:00.000Z');
      expect(feb29.valid).toBe(false);

      // 2026-04-31 rolls over to May 1 in Date.parse
      const apr31 = validateStrictIsoDateTime('2026-04-31T23:59:59.999Z');
      expect(apr31.valid).toBe(false);
    });
  });

  describe('4. Academic Year Range Validation (validateAcademicYearRange)', () => {
    it('accepts chronological start date and end date', () => {
      const res = validateAcademicYearRange('2026-06-01T00:00:00.000Z', '2027-04-30T00:00:00.000Z');
      expect(res.valid).toBe(true);
    });

    it('rejects identical start date and end date', () => {
      const res = validateAcademicYearRange('2026-06-01T00:00:00.000Z', '2026-06-01T00:00:00.000Z');
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/must precede end date/i);
    });

    it('rejects reversed start date and end date (startDate > endDate)', () => {
      const res = validateAcademicYearRange('2027-06-01T00:00:00.000Z', '2026-06-01T00:00:00.000Z');
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/must precede end date/i);
    });
  });

  describe('5. Zod Request Schemas (createAcademicYearSchema & addAcademicTermSchema)', () => {
    it('accepts valid academic year creation payload', () => {
      const validPayload = {
        name: 'SY 2028-2029 QA Test',
        startDate: '2028-06-05T00:00:00.000Z',
        endDate: '2029-04-10T00:00:00.000Z',
        isCurrent: false,
      };
      const parsed = createAcademicYearSchema.safeParse(validPayload);
      expect(parsed.success).toBe(true);
    });

    it('rejects reversed date range in createAcademicYearSchema', () => {
      const reversedPayload = {
        name: 'SY 2028-2029 Invalid Range',
        startDate: '2029-06-05T00:00:00.000Z',
        endDate: '2028-04-10T00:00:00.000Z',
        isCurrent: false,
      };
      const parsed = createAcademicYearSchema.safeParse(reversedPayload);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        const hasRangeIssue = parsed.error.issues.some((i) =>
          i.message.includes('must precede end date')
        );
        expect(hasRangeIssue).toBe(true);
      }
    });

    it('rejects impossible dates like Feb 31 in createAcademicYearSchema', () => {
      const impossibleDatePayload = {
        name: 'SY 2028-2029 Impossible Feb 31',
        startDate: '2028-02-31T00:00:00.000Z',
        endDate: '2028-12-31T00:00:00.000Z',
        isCurrent: false,
      };
      const parsed = createAcademicYearSchema.safeParse(impossibleDatePayload);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        const hasDateIssue = parsed.error.issues.some((i) =>
          i.message.includes('February has only 29 days in 2028')
        );
        expect(hasDateIssue).toBe(true);
      }
    });

    it('accepts valid term creation and rejects reversed term dates in addAcademicTermSchema', () => {
      const validTerm = {
        key: 'T4',
        name: 'Fourth Quarter',
        startDate: '2027-02-01T00:00:00.000Z',
        endDate: '2027-04-30T00:00:00.000Z',
      };
      expect(addAcademicTermSchema.safeParse(validTerm).success).toBe(true);

      const reversedTerm = {
        key: 'T4',
        name: 'Fourth Quarter Reversed',
        startDate: '2027-05-01T00:00:00.000Z',
        endDate: '2027-02-01T00:00:00.000Z',
      };
      const parsedReversed = addAcademicTermSchema.safeParse(reversedTerm);
      expect(parsedReversed.success).toBe(false);
    });
  });
});
