import { describe, it, expect } from 'vitest';
import { getPhilippineCalendarDate, parseCalendarDate, formatManilaTime } from '../src/common/utils/dateTime.js';

describe('Philippine Calendar Date Helper', () => {
  it('correctly resolves 11:59 PM Asia/Manila before midnight', () => {
    // 2026-10-14 23:59:00 in Manila (UTC+8) is 2026-10-14 15:59:00 UTC
    const instant = new Date('2026-10-14T15:59:00.000Z');
    const result = getPhilippineCalendarDate(instant);

    expect(result.dateStr).toBe('2026-10-14');
    expect(result.year).toBe(2026);
    expect(result.month).toBe(10);
    expect(result.day).toBe(14);
    expect(result.dateObj.toISOString()).toBe('2026-10-14T00:00:00.000Z');
  });

  it('correctly rolls over to 12:01 AM Asia/Manila after midnight', () => {
    // 2026-10-15 00:01:00 in Manila (UTC+8) is 2026-10-14 16:01:00 UTC
    const instant = new Date('2026-10-14T16:01:00.000Z');
    const result = getPhilippineCalendarDate(instant);

    expect(result.dateStr).toBe('2026-10-15');
    expect(result.year).toBe(2026);
    expect(result.month).toBe(10);
    expect(result.day).toBe(15);
    expect(result.dateObj.toISOString()).toBe('2026-10-15T00:00:00.000Z');
  });

  it('correctly handles UTC host where UTC calendar date differs from Manila date', () => {
    // Suppose host server is at 2026-10-13 23:30:00 UTC (Tuesday night in London).
    // In Manila (UTC+8), it is already Wednesday morning 2026-10-14 07:30:00 AM!
    const instant = new Date('2026-10-13T23:30:00.000Z');
    const result = getPhilippineCalendarDate(instant);

    // Must be October 14 Manila date, NOT October 13 UTC date!
    expect(result.dateStr).toBe('2026-10-14');
    expect(result.day).toBe(14);
    expect(result.dateObj.toISOString()).toBe('2026-10-14T00:00:00.000Z');
  });

  it('parses YYYY-MM-DD into midnight UTC Date', () => {
    const parsed = parseCalendarDate('2026-10-14');
    expect(parsed.toISOString()).toBe('2026-10-14T00:00:00.000Z');
  });

  it('formats Manila time as hh:mm A', () => {
    // 07:48 AM Manila is 23:48 UTC previous day
    const instant = new Date('2026-10-13T23:48:12.000Z');
    const timeStr = formatManilaTime(instant);
    expect(timeStr).toMatch(/07:48\s*AM/i);
  });
});
