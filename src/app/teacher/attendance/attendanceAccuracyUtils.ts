import { AStatus } from '../../shared/types';

export type RecordedAStatus = AStatus | null;

export interface RawAttendanceRecord {
  enrollment_id: string;
  date: string;
  status: AStatus;
}

export interface RosterEntry {
  id: string;
  student: {
    first_name: string;
    last_name: string;
    lrn?: string;
  };
}

const VALID_STATUSES: ReadonlySet<string> = new Set(['P', 'A', 'L', 'E']);

/**
 * Returns true if the given calendar date (year, 0-indexed month, 1-indexed day)
 * is strictly in the future relative to `referenceDate` (local calendar date).
 */
export function isFutureCalendarDate(
  year: number,
  monthZeroIndexed: number,
  day: number,
  referenceDate: Date = new Date()
): boolean {
  const refYear = referenceDate.getFullYear();
  const refMonth = referenceDate.getMonth();
  const refDay = referenceDate.getDate();

  if (year > refYear) return true;
  if (year < refYear) return false;
  if (monthZeroIndexed > refMonth) return true;
  if (monthZeroIndexed < refMonth) return false;
  return day > refDay;
}

/**
 * Builds the per-enrollment, per-day attendance map for a specific (year, monthZeroIndexed)
 * from raw backend `ClassAttendance` records.
 *
 * - Filters strictly to records matching `year` and `monthZeroIndexed` (UTC calendar date)
 *   so records from other months never bleed into the active month.
 * - Ignores future dates relative to `referenceDate`.
 * - Preserves only valid saved statuses ('P', 'A', 'L', 'E').
 * - Never fabricates 'P' or 'A' for unrecorded dates, weekends, or holidays.
 */
export function buildMonthlyAttendanceMap(
  records: RawAttendanceRecord[],
  year: number,
  monthZeroIndexed: number,
  referenceDate: Date = new Date()
): Record<string, Record<number, AStatus>> {
  const map: Record<string, Record<number, AStatus>> = {};
  if (!Array.isArray(records)) return map;

  for (const r of records) {
    if (!r || !r.enrollment_id || !r.date || !VALID_STATUSES.has(r.status)) {
      continue;
    }
    const parsed = new Date(r.date);
    if (Number.isNaN(parsed.getTime())) continue;

    const rYear = parsed.getUTCFullYear();
    const rMonth = parsed.getUTCMonth();
    const rDay = parsed.getUTCDate();

    if (rYear !== year || rMonth !== monthZeroIndexed) {
      continue;
    }
    if (isFutureCalendarDate(rYear, rMonth, rDay, referenceDate)) {
      continue;
    }

    if (!map[r.enrollment_id]) {
      map[r.enrollment_id] = {};
    }
    map[r.enrollment_id][rDay] = r.status;
  }

  return map;
}

/**
 * Returns the actual saved subject attendance status for `(enrollmentId, day)`,
 * or `null` if no record exists or if the date is in the future.
 *
 * Never defaults unrecorded dates, future dates, weekends, or holidays to "P" or "A".
 */
export function getRecordedStatus(
  attData: Record<string, Record<number, AStatus>>,
  enrollmentId: string,
  day: number,
  year?: number,
  monthZeroIndexed?: number,
  referenceDate: Date = new Date()
): RecordedAStatus {
  if (
    year !== undefined &&
    monthZeroIndexed !== undefined &&
    isFutureCalendarDate(year, monthZeroIndexed, day, referenceDate)
  ) {
    return null;
  }
  const saved = attData[enrollmentId]?.[day];
  if (!saved || !VALID_STATUSES.has(saved)) {
    return null;
  }
  return saved;
}

/**
 * Counts how many days in `daysInMonthList` have the exact saved status `targetStatus`
 * for `enrollmentId` (excluding future dates).
 */
export function countStudentStatusInMonth(
  attData: Record<string, Record<number, AStatus>>,
  enrollmentId: string,
  targetStatus: AStatus,
  daysInMonthList: number[],
  year: number,
  monthZeroIndexed: number,
  referenceDate: Date = new Date()
): number {
  return daysInMonthList.filter(
    (d) =>
      getRecordedStatus(attData, enrollmentId, d, year, monthZeroIndexed, referenceDate) ===
      targetStatus
  ).length;
}

/**
 * Counts how many days in `daysInMonthList` have an actual saved attendance record
 * (`P`, `A`, `L`, or `E`) for `enrollmentId` (excluding future dates).
 */
export function countStudentRecordedDaysInMonth(
  attData: Record<string, Record<number, AStatus>>,
  enrollmentId: string,
  daysInMonthList: number[],
  year: number,
  monthZeroIndexed: number,
  referenceDate: Date = new Date()
): number {
  return daysInMonthList.filter(
    (d) =>
      getRecordedStatus(attData, enrollmentId, d, year, monthZeroIndexed, referenceDate) !== null
  ).length;
}

/**
 * Counts how many days in `daysInMonthList` have NO recorded attendance (`null`)
 * for `enrollmentId`.
 */
export function countStudentUnrecordedDaysInMonth(
  attData: Record<string, Record<number, AStatus>>,
  enrollmentId: string,
  daysInMonthList: number[],
  year: number,
  monthZeroIndexed: number,
  referenceDate: Date = new Date()
): number {
  return daysInMonthList.filter(
    (d) =>
      getRecordedStatus(attData, enrollmentId, d, year, monthZeroIndexed, referenceDate) === null
  ).length;
}

/**
 * Computes a student's recorded subject-attendance rate (%) strictly from actual recorded days.
 * Returns `null` when `recordedDays === 0` so unrecorded months are displayed as "—"
 * rather than 100% or 0%.
 */
export function computeStudentRecordedAttendanceRate(
  attData: Record<string, Record<number, AStatus>>,
  enrollmentId: string,
  daysInMonthList: number[],
  year: number,
  monthZeroIndexed: number,
  referenceDate: Date = new Date()
): number | null {
  const recordedDays = countStudentRecordedDaysInMonth(
    attData,
    enrollmentId,
    daysInMonthList,
    year,
    monthZeroIndexed,
    referenceDate
  );
  if (recordedDays === 0) {
    return null;
  }
  const presentCount = countStudentStatusInMonth(
    attData,
    enrollmentId,
    'P',
    daysInMonthList,
    year,
    monthZeroIndexed,
    referenceDate
  );
  return Math.round((presentCount / recordedDays) * 100);
}

/**
 * Counts how many learners in `roster` have `targetStatus` (`'P' | 'A' | 'L' | 'E'` or `null` for Not Recorded)
 * on `selectedDate`.
 */
export function countRosterStatusOnDate(
  attData: Record<string, Record<number, AStatus>>,
  roster: Array<{ id: string }>,
  selectedDate: number,
  targetStatus: RecordedAStatus,
  year: number,
  monthZeroIndexed: number,
  referenceDate: Date = new Date()
): number {
  return roster.filter(
    (st) =>
      getRecordedStatus(attData, st.id, selectedDate, year, monthZeroIndexed, referenceDate) ===
      targetStatus
  ).length;
}

/**
 * Computes mini-calendar dot summary for a given day of the month.
 * Unrecorded days (`recordedCount === 0`) or future dates return `presentPct: null`
 * so they are never shown as 100% Present.
 */
export function computeDayCalendarSummary(
  attData: Record<string, Record<number, AStatus>>,
  roster: Array<{ id: string }>,
  day: number,
  year: number,
  monthZeroIndexed: number,
  referenceDate: Date = new Date()
): {
  isFuture: boolean;
  recordedCount: number;
  presentCount: number;
  unrecordedCount: number;
  presentPct: number | null;
} {
  const isFuture = isFutureCalendarDate(year, monthZeroIndexed, day, referenceDate);
  if (isFuture || roster.length === 0) {
    return {
      isFuture,
      recordedCount: 0,
      presentCount: 0,
      unrecordedCount: roster.length,
      presentPct: null,
    };
  }

  let recordedCount = 0;
  let presentCount = 0;

  for (const st of roster) {
    const s = getRecordedStatus(attData, st.id, day, year, monthZeroIndexed, referenceDate);
    if (s !== null) {
      recordedCount++;
      if (s === 'P') {
        presentCount++;
      }
    }
  }

  const unrecordedCount = roster.length - recordedCount;
  const presentPct = recordedCount > 0 ? Math.round((presentCount / recordedCount) * 100) : null;

  return {
    isFuture: false,
    recordedCount,
    presentCount,
    unrecordedCount,
    presentPct,
  };
}

/**
 * Cycles a cell in the Manual Attendance grid:
 * Not Recorded (`null`) -> P -> A -> L -> E -> P.
 */
export function cycleManualAttendanceStatus(current: RecordedAStatus): AStatus {
  if (current === null) return 'P';
  if (current === 'P') return 'A';
  if (current === 'A') return 'L';
  if (current === 'L') return 'E';
  return 'P';
}

/**
 * Builds bulk-save payload for a single selected date, including ONLY learners
 * with an explicit recorded status (`P`, `A`, `L`, `E`) on a non-future date.
 */
export function buildBulkSaveUpdatesForDate(
  attData: Record<string, Record<number, AStatus>>,
  roster: Array<{ id: string }>,
  day: number,
  year: number,
  monthZeroIndexed: number,
  referenceDate: Date = new Date()
): Array<{ studentEnrollmentId: string; date: string; status: AStatus }> {
  if (isFutureCalendarDate(year, monthZeroIndexed, day, referenceDate)) {
    return [];
  }
  const monthStr = (monthZeroIndexed + 1).toString().padStart(2, '0');
  const dayStr = day.toString().padStart(2, '0');
  const dateStr = `${year}-${monthStr}-${dayStr}`;

  const updates: Array<{ studentEnrollmentId: string; date: string; status: AStatus }> = [];
  for (const st of roster) {
    const s = getRecordedStatus(attData, st.id, day, year, monthZeroIndexed, referenceDate);
    if (s !== null) {
      updates.push({
        studentEnrollmentId: st.id,
        date: dateStr,
        status: s,
      });
    }
  }
  return updates;
}

/**
 * Builds bulk-save payload for an entire month, including ONLY (learner, date) entries
 * that have an explicit recorded status (`P`, `A`, `L`, `E`) on non-future dates.
 */
export function buildBulkSaveUpdatesForMonth(
  attData: Record<string, Record<number, AStatus>>,
  roster: Array<{ id: string }>,
  daysInMonthList: number[],
  year: number,
  monthZeroIndexed: number,
  referenceDate: Date = new Date()
): Array<{ studentEnrollmentId: string; date: string; status: AStatus }> {
  const monthStr = (monthZeroIndexed + 1).toString().padStart(2, '0');
  const updates: Array<{ studentEnrollmentId: string; date: string; status: AStatus }> = [];

  for (const st of roster) {
    for (const d of daysInMonthList) {
      const s = getRecordedStatus(attData, st.id, d, year, monthZeroIndexed, referenceDate);
      if (s !== null) {
        updates.push({
          studentEnrollmentId: st.id,
          date: `${year}-${monthStr}-${d.toString().padStart(2, '0')}`,
          status: s,
        });
      }
    }
  }

  return updates;
}

/**
 * Builds a Subject Class Attendance CSV string strictly from saved `ClassAttendance` records.
 *
 * - Clearly distinguishes per-subject attendance from official DepEd SF2 whole-day attendance.
 * - Unrecorded or future dates are exported as empty cells (`""`) and counted under `Not Recorded Days`.
 * - Never fabricates `"P"` or `"A"` for missing records.
 */
export function buildSubjectAttendanceCsv(
  attData: Record<string, Record<number, AStatus>>,
  roster: RosterEntry[],
  daysInMonth: number,
  year: number,
  monthZeroIndexed: number,
  referenceDate: Date = new Date()
): string {
  const dayColumns = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  let csv = "Learner's Name,";
  for (const d of dayColumns) {
    csv += `${d},`;
  }
  csv +=
    'Recorded Present,Recorded Absent,Recorded Late,Recorded Excused,Not Recorded Days\n';

  for (const st of roster) {
    const safeName = `${st.student.last_name}, ${st.student.first_name}`.replace(/"/g, '""');
    let row = `"${safeName}",`;
    let pCount = 0;
    let aCount = 0;
    let lCount = 0;
    let eCount = 0;
    let nrCount = 0;

    for (const d of dayColumns) {
      const s = getRecordedStatus(attData, st.id, d, year, monthZeroIndexed, referenceDate);
      if (s === 'P') pCount++;
      else if (s === 'A') aCount++;
      else if (s === 'L') lCount++;
      else if (s === 'E') eCount++;
      else nrCount++;

      row += `${s ?? ''},`;
    }

    row += `${pCount},${aCount},${lCount},${eCount},${nrCount}\n`;
    csv += row;
  }

  return csv;
}

