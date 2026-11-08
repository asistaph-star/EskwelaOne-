/**
 * DIGISKWELA — Phase G / G.1 Implementation Preparation for Official SF2/SF9
 * Module: calulutSf2Sf9Foundation.ts
 *
 * Service contracts, cross-record integrity validators, DepEd SF2 monthly attendance
 * aggregation rules, reconciled Calulut SF9 Excel cell mapping contracts, Grade
 * publication integer/optimistic-lock protectors, and Official SF9 Issuance guards.
 *
 * ARCHITECTURAL CONTRACT:
 * 1. Pure, deterministic validation & calculation layer that pairs with the
 *    composite foreign key and CHECK constraints in `phase_g_sf2_sf9_schema.prisma`.
 * 2. Preserves the authentic Calulut Excel SF9 template (`master_template_sanitized.xlsx`)
 *    and headless LibreOffice PDF rendering pipeline.
 * 3. Rejects contradictory cross-record relationships before DB persistence and
 *    mirrors the PostgreSQL composite foreign key guarantees.
 * 4. Enforces DepEd SF2 attendance rules and `OfficialAttendanceRecordStatus`:
 *    - Only `recordStatus === 'VERIFIED'` is counted for official SF9 output.
 *    - `recordStatus === 'DRAFT'` is rejected for official SF9 (`INCOMPLETE_UNVERIFIED_DRAFT_ATTENDANCE`).
 *    - `recordStatus === 'INVALIDATED_NON_INSTRUCTIONAL'` is excluded from instructional day counts.
 *    - 'P' = Present
 *    - 'A' = Absent
 *    - 'L' = Present + Tardy
 *    - 'E' = Excused (explicitly returns 'BLOCKED_PENDING_EXCUSED_POLICY' when
 *            Calulut's school-level policy is 'UNRESOLVED' instead of silently
 *            converting to Present or Absent).
 * 5. Enforces integer published term grades (60..100) and optimistic version locking.
 * 6. Enforces append-only, field-encrypted (`prisma-field-encryption`), SHA-256
 *    checksummed, student-isolated `Sf9OfficialIssuance` records.
 */

import type { Sf9Attendance, Sf9Comments } from './calulutSf9Generator.js';

// ─── 1. Reconciled Calulut Workbook Cell Mappings & Domain Enums ────────────

/**
 * Exact 11 monthly attendance slots in Calulut Integrated School's
 * `master_template_sanitized.xlsx`:
 * - Data-entry worksheet `'ATTENDANCE RECORD SUMMARY'` (`sheet7.xml`) uses columns `F..P`
 *   (Row 117 = monthly school days, E117 = SUM(F117:P117); Row 14 = Learner 1 days present).
 * - Report card worksheet `'SF9 - GRADE 4-10'` (`sheet6.xml`) uses columns `R..AB`
 *   (Row 4 = month headers Jun..Apr, Row 5 = No. of Class Days, Row 7 = No. of Days Present,
 *    Row 9 = No. of Days Absent, Column AC = Totals AC5, AC7, AC9).
 */
export const CALULUT_SF9_MONTH_SLOTS = [
  { index: 0, monthKey: 'JUN', label: 'Jun', monthOfYear: 6, summaryColumn: 'F', sf9Column: 'R', vlookupColIndex: 4 },
  { index: 1, monthKey: 'JUL', label: 'Jul', monthOfYear: 7, summaryColumn: 'G', sf9Column: 'S', vlookupColIndex: 5 },
  { index: 2, monthKey: 'AUG', label: 'Aug', monthOfYear: 8, summaryColumn: 'H', sf9Column: 'T', vlookupColIndex: 6 },
  { index: 3, monthKey: 'SEP', label: 'Sep', monthOfYear: 9, summaryColumn: 'I', sf9Column: 'U', vlookupColIndex: 7 },
  { index: 4, monthKey: 'OCT', label: 'Oct', monthOfYear: 10, summaryColumn: 'J', sf9Column: 'V', vlookupColIndex: 8 },
  { index: 5, monthKey: 'NOV', label: 'Nov', monthOfYear: 11, summaryColumn: 'K', sf9Column: 'W', vlookupColIndex: 9 },
  { index: 6, monthKey: 'DEC', label: 'Dec', monthOfYear: 12, summaryColumn: 'L', sf9Column: 'X', vlookupColIndex: 10 },
  { index: 7, monthKey: 'JAN', label: 'Jan', monthOfYear: 1, summaryColumn: 'M', sf9Column: 'Y', vlookupColIndex: 11 },
  { index: 8, monthKey: 'FEB', label: 'Feb', monthOfYear: 2, summaryColumn: 'N', sf9Column: 'Z', vlookupColIndex: 12 },
  { index: 9, monthKey: 'MAR', label: 'Mar', monthOfYear: 3, summaryColumn: 'O', sf9Column: 'AA', vlookupColIndex: 13 },
  { index: 10, monthKey: 'APR', label: 'Apr', monthOfYear: 4, summaryColumn: 'P', sf9Column: 'AB', vlookupColIndex: 14 },
] as const;

export const CALULUT_SF9_ATTENDANCE_CELLS = {
  summarySheet: 'ATTENDANCE RECORD SUMMARY',
  summaryClassDaysRow: 117,         // F117:P117 (monthly school days)
  summaryTotalClassDaysCell: 'E117', // =SUM(F117:P117)
  summaryDaysPresentRow: 14,        // F14:P14 (Learner 1 monthly days present)
  sf9Sheet: 'SF9 - GRADE 4-10',
  monthHeaderRow: 4,                // R4:AB4 ("Jun".."Apr"), AC4 ("Total")
  classDaysRow: 5,                  // R5:AB5 (merged R5:R6..AB5:AB6, ='ATTENDANCE RECORD SUMMARY'!F117..P117)
  daysPresentRow: 7,                // R7:AB7 (merged R7:R8..AB7:AB8, VLOOKUP into 'ATTENDANCE RECORD SUMMARY'!$C$14:$P$114)
  daysAbsentRow: 9,                 // R9:AB9 (merged R9:R10..AB9:AB10, =IF(R7="","",ABS(R5-R7)))
  totalColumn: 'AC',
  totalClassDaysCell: 'AC5',        // Merged AC5:AC6, =SUM(R5:AB6)
  totalDaysPresentCell: 'AC7',      // Merged AC7:AC8, =SUM(R7:AB8)
  totalDaysAbsentCell: 'AC9',       // Merged AC9:AC10, =ABS(AC5-AC7)
} as const;

export const CALULUT_SF9_COMMENT_CELLS = {
  entrySheet: 'TEACHERS COMMENTS',
  entryRow: 14,
  entryCells: {
    1: 'F14', // Merged F14:I14 (VLOOKUP col_index_num = 4)
    2: 'J14', // Merged J14:N14 (VLOOKUP col_index_num = 8)
    3: 'O14', // VLOOKUP col_index_num = 13
  },
  sf9Sheet: 'SF9 - GRADE 4-10',
  sf9Cells: {
    1: 'R15', // Merged R15:AC18, =IF(C17="","",VLOOKUP(C17,'TEACHERS COMMENTS'!C14:O114,4,0))
    2: 'R19', // Merged R19:AC22, =IF(C17="","",VLOOKUP(C17,'TEACHERS COMMENTS'!C14:O114,8,0))
    3: 'R23', // Merged R23:AC26, =IF(C17="","",VLOOKUP(C17,'TEACHERS COMMENTS'!C14:O114,13,0))
  },
} as const;

export const CALULUT_SF9_SIGNATORY_CELLS = {
  inputDataSheet: 'INPUT DATA',
  inputDataCells: {
    schoolHeadName: 'F19',
    adviserName: 'F26',
  },
  sf9Sheet: 'SF9 - GRADE 4-10',
  sf9Cells: {
    schoolHeadLetter: 'B27',                 // =IF('INPUT DATA'!F19="","",'INPUT DATA'!F19)
    adviserLetter: 'H27',                    // =IF('INPUT DATA'!F26="","",'INPUT DATA'!F26)
    adviserCertificateOfTransfer: 'X40',     // =IF('INPUT DATA'!F26="","",'INPUT DATA'!F26)
    schoolHeadCertificateOfTransfer: 'Q41',  // =IF('INPUT DATA'!F19="","",'INPUT DATA'!F19)
    schoolHeadCancellationOfTransfer: 'Q49', // =IF('INPUT DATA'!F19="","",'INPUT DATA'!F19)
  },
} as const;

export const CALULUT_SF9_GRADE_CELLS = {
  summarySheets: {
    1: 'TERM 1 SUMMARY',
    2: 'TERM 2 SUMMARY',
    3: 'TERM 3 SUMMARY',
  },
  summaryLearnerRow: 15,
  summaryColumns: {
    filipino: 'K',
    english: 'L',
    math: 'M',
    science: 'N',
    ap: 'O',
    gmrc: 'P',
    tle: 'Q',
    music: 'R',
    pe: 'S',
    mapeh: 'T', // Formula =IF(COUNT($R15:$S15)=0,"",ROUND(AVERAGE(R15:S15),0))
  },
  sf9Sheet: 'SF9 - GRADE 4-10',
  sf9TermColumns: {
    1: 'F',
    2: 'G',
    3: 'H',
  },
  sf9FinalColumn: 'I',
  sf9RemarksColumn: 'J',
  sf9SubjectRows: {
    filipino: 32,
    english: 33,
    math: 34,
    science: 35,
    ap: 36,
    gmrc: 37,
    tle: 38,
    mapeh: 39,
    music: 40,
    pe: 41,
  },
  generalAverageCell: 'I42', // =IF(COUNT(I32:I39)=0,"",ROUND(AVERAGE(I32:I39),0))
  generalRemarksCell: 'J42', // =IF(I42="", "", IF(I42>=75, "Passed", "Failed"))
} as const;

export type CalendarDayKind =
  | 'INSTRUCTIONAL'
  | 'WEEKEND'
  | 'REGULAR_HOLIDAY'
  | 'SPECIAL_NON_WORKING_HOLIDAY'
  | 'CLASS_SUSPENSION'
  | 'MAKEUP_INSTRUCTIONAL'
  | 'SCHOOL_ACTIVITY_NON_INSTRUCTIONAL';

export type CalendarMonthLifecycleStatus = 'DRAFT' | 'REVIEWED' | 'FINALIZED';

export type OfficialAttendanceStatusCode = 'P' | 'A' | 'L' | 'E';

/**
 * Aligned 1-to-1 with Prisma enum `OfficialAttendanceRecordStatus` in
 * `phase_g_sf2_sf9_schema.prisma` and `phase_g_sf2_sf9_migration.draft.sql`:
 * - `DRAFT`: Saved by Class Adviser, not yet verified for official SF2/SF9 release.
 * - `VERIFIED`: Verified official daily attendance eligible for SF2/SF9 aggregation.
 * - `INVALIDATED_NON_INSTRUCTIONAL`: Preserved for audit after a calendar day is
 *   reclassified to non-instructional/suspended; excluded from instructional counts.
 */
export type OfficialAttendanceRecordStatus =
  | 'DRAFT'
  | 'VERIFIED'
  | 'INVALIDATED_NON_INSTRUCTIONAL';

export type ExcusedAttendancePolicy =
  | 'UNRESOLVED'
  | 'COUNT_AS_PRESENT'
  | 'COUNT_AS_EXCUSED_ABSENCE';

export type AdviserCommentStatus = 'DRAFT' | 'PUBLISHED';

export type Sf9IssuanceLifecycleStatus = 'ISSUED' | 'SUPERSEDED' | 'REVOKED';

// ─── 2. Record Contracts for Cross-Record Integrity Validation ──────────────

export interface AcademicYearRef {
  id: string;
  year: string;
  startDate: string; // YYYY-MM-DD in Asia/Manila
  endDate: string;   // YYYY-MM-DD in Asia/Manila
}

export interface SectionRef {
  id: string;
  academicYearId: string;
  adviserId: string | null;
  gradeLevel: number;
  name: string;
}

export interface EnrollmentRef {
  id: string;
  studentId: string;
  sectionId: string;
  academicYearId: string;
  status: 'Active' | 'Enrolled' | 'Completed' | 'Dropped' | 'Transferred';
  effectiveStartDate?: string; // YYYY-MM-DD (for mid-year transfer-in)
  effectiveEndDate?: string;   // YYYY-MM-DD (for mid-year transfer-out / drop)
}

export interface SchoolCalendarMonthRecord {
  id: string;
  academicYearId: string;
  calendarYear: number;
  monthOfYear: number;    // 1..12
  sf9ColumnIndex: number; // 0..10 (Jun..Apr)
  status: CalendarMonthLifecycleStatus;
  reopenReason?: string | null;
}

export interface SchoolCalendarDayRecord {
  id: string;
  academicYearId: string;
  calendarMonthId: string;
  date: string; // YYYY-MM-DD in Asia/Manila
  dayKind: CalendarDayKind;
  isInstructional: boolean;
  reason?: string | null;
}

export interface SectionCalendarExceptionRecord {
  id: string;
  academicYearId: string;
  sectionId: string;
  calendarDayId: string;
  overrideDayKind: CalendarDayKind;
  overrideIsInstructional: boolean;
  reason: string;
}

export interface OfficialDailyAttendanceRecord {
  id: string;
  academicYearId: string;
  sectionId: string;
  enrollmentId: string;
  studentId: string;
  calendarDayId: string;
  date: string; // YYYY-MM-DD in Asia/Manila
  status: OfficialAttendanceStatusCode;
  recordStatus: OfficialAttendanceRecordStatus;
  tardyMinutes?: number | null;
  remarks?: string | null;
  recordedById: string;
  verifiedById?: string | null;
  invalidationReason?: string | null;
}

export interface IntegrityValidationResult {
  valid: boolean;
  code?:
    | 'INVALID_DATE_FORMAT'
    | 'CROSS_ACADEMIC_YEAR_MISMATCH'
    | 'DATE_OUTSIDE_ACADEMIC_YEAR'
    | 'DATE_MONTH_MISMATCH'
    | 'DAY_KIND_INSTRUCTIONAL_MISMATCH'
    | 'CONTRADICTORY_CALENDAR_DAY_DATE'
    | 'CONTRADICTORY_ENROLLMENT_STUDENT'
    | 'CONTRADICTORY_ENROLLMENT_SECTION'
    | 'CONTRADICTORY_ENROLLMENT_ACADEMIC_YEAR'
    | 'CONTRADICTORY_SECTION_ACADEMIC_YEAR'
    | 'NON_INSTRUCTIONAL_DATE_ATTENDANCE_FORBIDDEN'
    | 'FUTURE_DATE_ATTENDANCE_FORBIDDEN'
    | 'OUTSIDE_ENROLLMENT_ACTIVE_WINDOW'
    | 'INVALID_SF9_MONTH_SLOT_MAPPING';
  message?: string;
}

// ─── 3. Asia/Manila Calendar Date Utilities (No UTC Drift) ──────────────────

const ISO_DATE_ONLY_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface ParsedManilaDate {
  year: number;
  month: number; // 1..12
  day: number;   // 1..31
  isoDate: string;
}

/**
 * Parses a strict YYYY-MM-DD string representing an Asia/Manila calendar date
 * without relying on local system timezone offsets.
 */
export function parseManilaDateOnly(dateStr: string): ParsedManilaDate | null {
  const match = ISO_DATE_ONLY_REGEX.exec(dateStr);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12 || day < 1) return null;
  const maxDays = getDaysInCalendarMonth(year, month);
  if (day > maxDays) return null;

  return {
    year,
    month,
    day,
    isoDate: `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
  };
}

export function getDaysInCalendarMonth(year: number, monthOfYear: number): number {
  return new Date(Date.UTC(year, monthOfYear, 0)).getUTCDate();
}

export function enumerateDatesInMonth(year: number, monthOfYear: number): string[] {
  const totalDays = getDaysInCalendarMonth(year, monthOfYear);
  const dates: string[] = [];
  for (let d = 1; d <= totalDays; d++) {
    dates.push(
      `${String(year).padStart(4, '0')}-${String(monthOfYear).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    );
  }
  return dates;
}

function isInstructionalDayKind(kind: CalendarDayKind): boolean {
  return kind === 'INSTRUCTIONAL' || kind === 'MAKEUP_INSTRUCTIONAL';
}

// ─── 4. Cross-Record Relationship Integrity Validators ──────────────────────

/**
 * Validates that a `SchoolCalendarMonth` matches the Calulut SF9 month slot
 * convention (0=Jun .. 10=Apr) and belongs to the AcademicYear window.
 */
export function validateCalendarMonthDefinition(
  month: SchoolCalendarMonthRecord,
  academicYear: AcademicYearRef
): IntegrityValidationResult {
  if (month.academicYearId !== academicYear.id) {
    return {
      valid: false,
      code: 'CROSS_ACADEMIC_YEAR_MISMATCH',
      message: `SchoolCalendarMonth academicYearId (${month.academicYearId}) does not match AcademicYear (${academicYear.id}).`,
    };
  }

  const expectedSlot = CALULUT_SF9_MONTH_SLOTS.find(
    (s) => s.index === month.sf9ColumnIndex
  );
  if (!expectedSlot || expectedSlot.monthOfYear !== month.monthOfYear) {
    return {
      valid: false,
      code: 'INVALID_SF9_MONTH_SLOT_MAPPING',
      message: `sf9ColumnIndex=${month.sf9ColumnIndex} requires monthOfYear=${expectedSlot?.monthOfYear ?? '0..10'}, received ${month.monthOfYear}.`,
    };
  }

  return { valid: true };
}

/**
 * Validates `SchoolCalendarDay` against its parent `SchoolCalendarMonth` and
 * `AcademicYear`, mirroring composite FK `(calendar_month_id, academic_year_id)`
 * and date/kind consistency CHECK constraints.
 */
export function validateCalendarDayRelationship(
  day: SchoolCalendarDayRecord,
  month: SchoolCalendarMonthRecord,
  academicYear: AcademicYearRef
): IntegrityValidationResult {
  const parsed = parseManilaDateOnly(day.date);
  if (!parsed) {
    return {
      valid: false,
      code: 'INVALID_DATE_FORMAT',
      message: `Invalid Asia/Manila date format: ${day.date}. Expected YYYY-MM-DD.`,
    };
  }

  if (
    day.academicYearId !== month.academicYearId ||
    day.academicYearId !== academicYear.id ||
    day.calendarMonthId !== month.id
  ) {
    return {
      valid: false,
      code: 'CROSS_ACADEMIC_YEAR_MISMATCH',
      message:
        'SchoolCalendarDay academic_year_id / calendar_month_id does not match parent SchoolCalendarMonth and AcademicYear.',
    };
  }

  if (parsed.year !== month.calendarYear || parsed.month !== month.monthOfYear) {
    return {
      valid: false,
      code: 'DATE_MONTH_MISMATCH',
      message: `Calendar day ${day.date} does not belong to SchoolCalendarMonth ${month.calendarYear}-${String(month.monthOfYear).padStart(2, '0')}.`,
    };
  }

  if (day.date < academicYear.startDate || day.date > academicYear.endDate) {
    return {
      valid: false,
      code: 'DATE_OUTSIDE_ACADEMIC_YEAR',
      message: `Calendar day ${day.date} falls outside AcademicYear range (${academicYear.startDate}..${academicYear.endDate}).`,
    };
  }

  const expectedInstructional = isInstructionalDayKind(day.dayKind);
  if (day.isInstructional !== expectedInstructional) {
    return {
      valid: false,
      code: 'DAY_KIND_INSTRUCTIONAL_MISMATCH',
      message: `dayKind=${day.dayKind} conflicts with isInstructional=${day.isInstructional}.`,
    };
  }

  return { valid: true };
}

/**
 * Validates `SectionCalendarException` against `Section` and `SchoolCalendarDay`,
 * mirroring composite FKs `(section_id, academic_year_id)` and
 * `(calendar_day_id, academic_year_id, date)`.
 */
export function validateSectionCalendarExceptionRelationship(
  exception: SectionCalendarExceptionRecord,
  section: SectionRef,
  calendarDay: SchoolCalendarDayRecord
): IntegrityValidationResult {
  if (exception.sectionId !== section.id || exception.academicYearId !== section.academicYearId) {
    return {
      valid: false,
      code: 'CONTRADICTORY_SECTION_ACADEMIC_YEAR',
      message: `SectionCalendarException (${exception.sectionId}, ${exception.academicYearId}) conflicts with Section (${section.id}, ${section.academicYearId}).`,
    };
  }

  if (
    exception.calendarDayId !== calendarDay.id ||
    exception.academicYearId !== calendarDay.academicYearId
  ) {
    return {
      valid: false,
      code: 'CROSS_ACADEMIC_YEAR_MISMATCH',
      message: `SectionCalendarException academicYearId (${exception.academicYearId}) conflicts with SchoolCalendarDay (${calendarDay.id}, ${calendarDay.academicYearId}).`,
    };
  }

  const expectedInstructional = isInstructionalDayKind(exception.overrideDayKind);
  if (exception.overrideIsInstructional !== expectedInstructional) {
    return {
      valid: false,
      code: 'DAY_KIND_INSTRUCTIONAL_MISMATCH',
      message: `overrideDayKind=${exception.overrideDayKind} conflicts with overrideIsInstructional=${exception.overrideIsInstructional}.`,
    };
  }

  return { valid: true };
}

/**
 * Validates `OfficialDailyAttendance` against `Enrollment`, `Section`,
 * `SchoolCalendarDay`, optional `SectionCalendarException`, and current Manila date.
 *
 * Guarantees at the service layer (mirroring DB composite FKs):
 * - No `studentId` from Student A paired with `enrollmentId` from Student B.
 * - No `sectionId` different from the enrollment's section.
 * - No `academicYearId` different from the enrollment, section, or calendar day.
 * - No `calendarDayId` whose `date` differs from `attendance.date`.
 * - No recording of `DRAFT` or `VERIFIED` attendance on a non-instructional date
 *   (after section exception resolution).
 * - No recording on a future Asia/Manila date.
 */
export function validateOfficialDailyAttendanceRelationship(params: {
  attendance: OfficialDailyAttendanceRecord;
  enrollment: EnrollmentRef;
  section: SectionRef;
  calendarDay: SchoolCalendarDayRecord;
  sectionException?: SectionCalendarExceptionRecord | null;
  currentManilaDate: string; // YYYY-MM-DD
}): IntegrityValidationResult {
  const {
    attendance,
    enrollment,
    section,
    calendarDay,
    sectionException,
    currentManilaDate,
  } = params;

  const parsedAttDate = parseManilaDateOnly(attendance.date);
  if (!parsedAttDate) {
    return {
      valid: false,
      code: 'INVALID_DATE_FORMAT',
      message: `Invalid attendance date format: ${attendance.date}.`,
    };
  }

  // 1. Enrollment <-> Student match
  if (attendance.enrollmentId !== enrollment.id || attendance.studentId !== enrollment.studentId) {
    return {
      valid: false,
      code: 'CONTRADICTORY_ENROLLMENT_STUDENT',
      message: `Attendance studentId (${attendance.studentId}) does not match Enrollment (${enrollment.id} -> student ${enrollment.studentId}).`,
    };
  }

  // 2. Enrollment <-> Section match
  if (attendance.sectionId !== enrollment.sectionId || attendance.sectionId !== section.id) {
    return {
      valid: false,
      code: 'CONTRADICTORY_ENROLLMENT_SECTION',
      message: `Attendance sectionId (${attendance.sectionId}) does not match Enrollment sectionId (${enrollment.sectionId}).`,
    };
  }

  // 3. Enrollment <-> Section <-> AcademicYear match
  if (
    attendance.academicYearId !== enrollment.academicYearId ||
    attendance.academicYearId !== section.academicYearId
  ) {
    return {
      valid: false,
      code: 'CONTRADICTORY_ENROLLMENT_ACADEMIC_YEAR',
      message: `Attendance academicYearId (${attendance.academicYearId}) conflicts with Enrollment/Section academicYearId (${enrollment.academicYearId}).`,
    };
  }

  // 4. CalendarDay <-> AcademicYear & Date match
  if (
    attendance.calendarDayId !== calendarDay.id ||
    attendance.academicYearId !== calendarDay.academicYearId
  ) {
    return {
      valid: false,
      code: 'CROSS_ACADEMIC_YEAR_MISMATCH',
      message: `Attendance calendarDayId (${attendance.calendarDayId}) belongs to academicYearId (${calendarDay.academicYearId}), expected (${attendance.academicYearId}).`,
    };
  }

  if (attendance.date !== calendarDay.date) {
    return {
      valid: false,
      code: 'CONTRADICTORY_CALENDAR_DAY_DATE',
      message: `Attendance date (${attendance.date}) does not match SchoolCalendarDay.date (${calendarDay.date}).`,
    };
  }

  // 5. Future date check
  if (attendance.date > currentManilaDate) {
    return {
      valid: false,
      code: 'FUTURE_DATE_ATTENDANCE_FORBIDDEN',
      message: `Cannot record official daily attendance for future date ${attendance.date} (today in Asia/Manila is ${currentManilaDate}).`,
    };
  }

  // 6. Validate section exception (if present) and effective instructional status
  if (sectionException) {
    const excCheck = validateSectionCalendarExceptionRelationship(
      sectionException,
      section,
      calendarDay
    );
    if (!excCheck.valid) {
      return excCheck;
    }
  }

  const effectiveInstructional = sectionException
    ? sectionException.overrideIsInstructional
    : calendarDay.isInstructional;

  if (!effectiveInstructional && attendance.recordStatus !== 'INVALIDATED_NON_INSTRUCTIONAL') {
    return {
      valid: false,
      code: 'NON_INSTRUCTIONAL_DATE_ATTENDANCE_FORBIDDEN',
      message: `Cannot record ${attendance.recordStatus} official attendance on non-instructional date ${attendance.date}.`,
    };
  }

  // 7. Transfer / enrollment effective window check
  if (enrollment.effectiveStartDate && attendance.date < enrollment.effectiveStartDate) {
    return {
      valid: false,
      code: 'OUTSIDE_ENROLLMENT_ACTIVE_WINDOW',
      message: `Date ${attendance.date} precedes learner enrollment effectiveStartDate (${enrollment.effectiveStartDate}).`,
    };
  }
  if (enrollment.effectiveEndDate && attendance.date > enrollment.effectiveEndDate) {
    return {
      valid: false,
      code: 'OUTSIDE_ENROLLMENT_ACTIVE_WINDOW',
      message: `Date ${attendance.date} is after learner enrollment effectiveEndDate (${enrollment.effectiveEndDate}).`,
    };
  }

  return { valid: true };
}

// ─── 5. Calendar Completeness, Reopening & SF2/SF9 Attendance Aggregation ───

export interface CalendarMonthCompletenessEvaluation {
  canFinalize: boolean;
  expectedDayCount: number;
  classifiedDayCount: number;
  missingDates: string[];
  invalidDays: string[];
  instructionalDates: string[];
}

/**
 * Verifies whether a `SchoolCalendarMonth` can transition to `FINALIZED`.
 * Every calendar date in `(calendarYear, monthOfYear)` within the AcademicYear
 * range must have a valid `SchoolCalendarDay` row.
 */
export function evaluateCalendarMonthCompleteness(params: {
  month: SchoolCalendarMonthRecord;
  academicYear: AcademicYearRef;
  calendarDays: SchoolCalendarDayRecord[];
}): CalendarMonthCompletenessEvaluation {
  const { month, academicYear, calendarDays } = params;
  const allMonthDates = enumerateDatesInMonth(month.calendarYear, month.monthOfYear).filter(
    (d) => d >= academicYear.startDate && d <= academicYear.endDate
  );

  const byDate = new Map<string, SchoolCalendarDayRecord>();
  const invalidDays: string[] = [];

  for (const day of calendarDays) {
    const check = validateCalendarDayRelationship(day, month, academicYear);
    if (!check.valid) {
      invalidDays.push(`${day.date}:${check.code}`);
      continue;
    }
    if (byDate.has(day.date)) {
      invalidDays.push(`${day.date}:DUPLICATE_CALENDAR_DATE`);
      continue;
    }
    byDate.set(day.date, day);
  }

  const missingDates = allMonthDates.filter((d) => !byDate.has(d));
  const instructionalDates = allMonthDates.filter(
    (d) => byDate.get(d)?.isInstructional === true
  );

  return {
    canFinalize:
      allMonthDates.length > 0 && missingDates.length === 0 && invalidDays.length === 0,
    expectedDayCount: allMonthDates.length,
    classifiedDayCount: byDate.size,
    missingDates,
    invalidDays,
    instructionalDates,
  };
}

export interface CalendarReclassificationImpactPlan {
  requiresMonthReopen: boolean;
  transitionType:
    | 'NO_CHANGE'
    | 'INSTRUCTIONAL_TO_SUSPENDED'
    | 'NON_INSTRUCTIONAL_TO_MAKEUP_INSTRUCTIONAL';
  attendanceIdsToInvalidate: string[];
  invalidationReason: string | null;
  requiresNewAttendanceEntryForSection: boolean;
}

/**
 * Computes the transactional impact of reclassifying a calendar day (or adding a
 * section exception) after attendance has already been recorded:
 * - If an instructional day becomes suspended/non-instructional: existing `DRAFT`
 *   or `VERIFIED` attendance rows for that date are marked
 *   `INVALIDATED_NON_INSTRUCTIONAL` (never silently deleted) and excluded from
 *   SF2/SF9 counts.
 * - If a non-instructional day becomes a makeup instructional day: the month
 *   becomes incomplete for SF9 issuance until `VERIFIED` attendance is recorded
 *   for all active learners on that new instructional date.
 */
export function planCalendarDayReclassificationImpact(params: {
  monthStatus: CalendarMonthLifecycleStatus;
  previousEffectiveInstructional: boolean;
  nextEffectiveInstructional: boolean;
  reclassificationReason: string;
  existingAttendanceOnDate: OfficialDailyAttendanceRecord[];
}): CalendarReclassificationImpactPlan {
  const {
    monthStatus,
    previousEffectiveInstructional,
    nextEffectiveInstructional,
    reclassificationReason,
    existingAttendanceOnDate,
  } = params;

  if (previousEffectiveInstructional === nextEffectiveInstructional) {
    return {
      requiresMonthReopen: false,
      transitionType: 'NO_CHANGE',
      attendanceIdsToInvalidate: [],
      invalidationReason: null,
      requiresNewAttendanceEntryForSection: false,
    };
  }

  if (previousEffectiveInstructional && !nextEffectiveInstructional) {
    const activeIds = existingAttendanceOnDate
      .filter((r) => r.recordStatus === 'DRAFT' || r.recordStatus === 'VERIFIED')
      .map((r) => r.id);
    return {
      requiresMonthReopen: monthStatus === 'FINALIZED',
      transitionType: 'INSTRUCTIONAL_TO_SUSPENDED',
      attendanceIdsToInvalidate: activeIds,
      invalidationReason: reclassificationReason,
      requiresNewAttendanceEntryForSection: false,
    };
  }

  return {
    requiresMonthReopen: monthStatus === 'FINALIZED',
    transitionType: 'NON_INSTRUCTIONAL_TO_MAKEUP_INSTRUCTIONAL',
    attendanceIdsToInvalidate: [],
    invalidationReason: null,
    requiresNewAttendanceEntryForSection: true,
  };
}

export type Sf2MonthAggregationVerificationState =
  | 'VERIFIED'
  | 'INCOMPLETE_CALENDAR_NOT_FINALIZED'
  | 'INCOMPLETE_MISSING_ATTENDANCE'
  | 'INCOMPLETE_UNVERIFIED_DRAFT_ATTENDANCE'
  | 'BLOCKED_PENDING_EXCUSED_POLICY'
  | 'REJECTED_INTEGRITY_VIOLATION';

export interface Sf2MonthlyStudentSummary {
  sf9ColumnIndex: number; // 0..10
  monthOfYear: number;    // 1..12
  calendarYear: number;
  verificationState: Sf2MonthAggregationVerificationState;
  classDays: number;
  daysPresent: number;
  daysAbsent: number;
  daysTardy: number;
  daysExcused: number;
  missingInstructionalDates: string[];
  unverifiedDraftDates: string[];
  excusedDates: string[];
  integrityErrors: string[];
}

/**
 * Resolves the effective instructional dates for a section in a given month,
 * applying `SectionCalendarException` at most once per `(sectionId, calendarDayId)`.
 */
export function resolveEffectiveInstructionalDaysForSection(params: {
  section: SectionRef;
  calendarDays: SchoolCalendarDayRecord[];
  sectionExceptions: SectionCalendarExceptionRecord[];
}): {
  effectiveInstructionalDays: SchoolCalendarDayRecord[];
  integrityErrors: string[];
} {
  const { section, calendarDays, sectionExceptions } = params;
  const integrityErrors: string[] = [];

  const exceptionByDayId = new Map<string, SectionCalendarExceptionRecord>();
  for (const exc of sectionExceptions) {
    if (exc.sectionId !== section.id) continue;
    if (exceptionByDayId.has(exc.calendarDayId)) {
      integrityErrors.push(
        `Duplicate SectionCalendarException for section=${section.id}, calendarDayId=${exc.calendarDayId}`
      );
      continue;
    }
    exceptionByDayId.set(exc.calendarDayId, exc);
  }

  const effectiveInstructionalDays: SchoolCalendarDayRecord[] = [];
  const seenDates = new Set<string>();

  const sortedDays = [...calendarDays].sort((a, b) => a.date.localeCompare(b.date));
  for (const day of sortedDays) {
    if (seenDates.has(day.date)) {
      integrityErrors.push(`Duplicate SchoolCalendarDay date=${day.date}`);
      continue;
    }
    seenDates.add(day.date);

    const exc = exceptionByDayId.get(day.id);
    if (exc) {
      const check = validateSectionCalendarExceptionRelationship(exc, section, day);
      if (!check.valid) {
        integrityErrors.push(check.message ?? 'Invalid SectionCalendarException');
        continue;
      }
    }

    const isInstructional = exc ? exc.overrideIsInstructional : day.isInstructional;
    if (isInstructional) {
      effectiveInstructionalDays.push(day);
    }
  }

  return { effectiveInstructionalDays, integrityErrors };
}

/**
 * Computes a student's DepEd SF2 monthly attendance summary for a single
 * `SchoolCalendarMonth` and determines whether it is `VERIFIED` for Calulut SF9:
 * - Only rows with `recordStatus === 'VERIFIED'` are counted for official SF9 output.
 * - Rows with `recordStatus === 'DRAFT'` are flagged in `unverifiedDraftDates` and
 *   return `INCOMPLETE_UNVERIFIED_DRAFT_ATTENDANCE` (never silently counted as verified!).
 * - Rows with `recordStatus === 'INVALIDATED_NON_INSTRUCTIONAL'` are excluded.
 * - `P` -> +1 Present, +0 Absent, +0 Tardy
 * - `A` -> +0 Present, +1 Absent, +0 Tardy
 * - `L` -> +1 Present, +0 Absent, +1 Tardy (DepEd SF2 Tardy/Late rule)
 * - `E` -> If `excusedPolicy === 'UNRESOLVED'`, returns
 *          `BLOCKED_PENDING_EXCUSED_POLICY` so `E` is never silently converted!
 */
export function aggregateStudentMonthlyAttendanceForSf9(params: {
  month: SchoolCalendarMonthRecord;
  academicYear: AcademicYearRef;
  section: SectionRef;
  enrollment: EnrollmentRef;
  calendarDays: SchoolCalendarDayRecord[];
  sectionExceptions: SectionCalendarExceptionRecord[];
  attendanceRecords: OfficialDailyAttendanceRecord[];
  excusedPolicy?: ExcusedAttendancePolicy;
  currentManilaDate: string;
}): Sf2MonthlyStudentSummary {
  const {
    month,
    academicYear,
    section,
    enrollment,
    calendarDays,
    sectionExceptions,
    attendanceRecords,
    excusedPolicy = 'UNRESOLVED',
    currentManilaDate,
  } = params;

  const integrityErrors: string[] = [];

  // 1. Validate month & calendar completeness
  const monthCheck = validateCalendarMonthDefinition(month, academicYear);
  if (!monthCheck.valid) {
    integrityErrors.push(monthCheck.message ?? 'Invalid calendar month');
  }

  const completeness = evaluateCalendarMonthCompleteness({
    month,
    academicYear,
    calendarDays,
  });
  if (completeness.invalidDays.length > 0) {
    integrityErrors.push(...completeness.invalidDays);
  }

  // 2. Resolve effective instructional days for the section (applying exceptions once)
  const { effectiveInstructionalDays, integrityErrors: excErrors } =
    resolveEffectiveInstructionalDaysForSection({
      section,
      calendarDays,
      sectionExceptions,
    });
  integrityErrors.push(...excErrors);

  // Filter instructional days to the learner's active enrollment window
  const applicableInstructionalDays = effectiveInstructionalDays.filter((day) => {
    if (enrollment.effectiveStartDate && day.date < enrollment.effectiveStartDate) {
      return false;
    }
    if (enrollment.effectiveEndDate && day.date > enrollment.effectiveEndDate) {
      return false;
    }
    return true;
  });

  // 3. Index non-invalidated (DRAFT or VERIFIED) attendance records for this learner & month
  const nonInvalidatedByDayId = new Map<string, OfficialDailyAttendanceRecord>();
  const dayById = new Map(calendarDays.map((d) => [d.id, d]));
  const excByDayId = new Map(
    sectionExceptions.filter((e) => e.sectionId === section.id).map((e) => [e.calendarDayId, e])
  );

  for (const record of attendanceRecords) {
    // Exclude invalidated rows (e.g., suspended days after calendar reopening)
    if (record.recordStatus === 'INVALIDATED_NON_INSTRUCTIONAL') {
      continue;
    }

    const calendarDay = dayById.get(record.calendarDayId);
    if (!calendarDay) {
      integrityErrors.push(
        `Attendance record ${record.id} references unknown calendarDayId ${record.calendarDayId} for month ${month.calendarYear}-${month.monthOfYear}.`
      );
      continue;
    }

    const relCheck = validateOfficialDailyAttendanceRelationship({
      attendance: record,
      enrollment,
      section,
      calendarDay,
      sectionException: excByDayId.get(calendarDay.id) ?? null,
      currentManilaDate,
    });
    if (!relCheck.valid) {
      integrityErrors.push(relCheck.message ?? `Integrity error on attendance ${record.id}`);
      continue;
    }

    if (nonInvalidatedByDayId.has(record.calendarDayId)) {
      integrityErrors.push(
        `Duplicate non-invalidated attendance record for enrollment=${enrollment.id}, calendarDayId=${record.calendarDayId}`
      );
      continue;
    }
    nonInvalidatedByDayId.set(record.calendarDayId, record);
  }

  if (integrityErrors.length > 0) {
    return {
      sf9ColumnIndex: month.sf9ColumnIndex,
      monthOfYear: month.monthOfYear,
      calendarYear: month.calendarYear,
      verificationState: 'REJECTED_INTEGRITY_VIOLATION',
      classDays: applicableInstructionalDays.length,
      daysPresent: 0,
      daysAbsent: 0,
      daysTardy: 0,
      daysExcused: 0,
      missingInstructionalDates: [],
      unverifiedDraftDates: [],
      excusedDates: [],
      integrityErrors,
    };
  }

  // 4. Tally P, A, L, E across applicable instructional days (ONLY counting VERIFIED rows)
  let daysPresent = 0;
  let daysAbsent = 0;
  let daysTardy = 0;
  let daysExcused = 0;
  const missingInstructionalDates: string[] = [];
  const unverifiedDraftDates: string[] = [];
  const excusedDates: string[] = [];

  for (const day of applicableInstructionalDays) {
    const rec = nonInvalidatedByDayId.get(day.id);
    if (!rec) {
      missingInstructionalDates.push(day.date);
      continue;
    }

    if (rec.recordStatus === 'DRAFT') {
      // DRAFT attendance is never silently counted as verified for official SF9 output
      unverifiedDraftDates.push(day.date);
      continue;
    }

    switch (rec.status) {
      case 'P':
        daysPresent += 1;
        break;
      case 'A':
        daysAbsent += 1;
        break;
      case 'L':
        daysPresent += 1;
        daysTardy += 1;
        break;
      case 'E':
        daysExcused += 1;
        excusedDates.push(day.date);
        if (excusedPolicy === 'COUNT_AS_PRESENT') {
          daysPresent += 1;
        } else if (excusedPolicy === 'COUNT_AS_EXCUSED_ABSENCE') {
          daysAbsent += 1;
        }
        break;
    }
  }

  // 5. Determine verification state
  if (month.status !== 'FINALIZED' || !completeness.canFinalize) {
    return {
      sf9ColumnIndex: month.sf9ColumnIndex,
      monthOfYear: month.monthOfYear,
      calendarYear: month.calendarYear,
      verificationState: 'INCOMPLETE_CALENDAR_NOT_FINALIZED',
      classDays: applicableInstructionalDays.length,
      daysPresent,
      daysAbsent,
      daysTardy,
      daysExcused,
      missingInstructionalDates,
      unverifiedDraftDates,
      excusedDates,
      integrityErrors: [],
    };
  }

  if (missingInstructionalDates.length > 0) {
    return {
      sf9ColumnIndex: month.sf9ColumnIndex,
      monthOfYear: month.monthOfYear,
      calendarYear: month.calendarYear,
      verificationState: 'INCOMPLETE_MISSING_ATTENDANCE',
      classDays: applicableInstructionalDays.length,
      daysPresent,
      daysAbsent,
      daysTardy,
      daysExcused,
      missingInstructionalDates,
      unverifiedDraftDates,
      excusedDates,
      integrityErrors: [],
    };
  }

  if (unverifiedDraftDates.length > 0) {
    return {
      sf9ColumnIndex: month.sf9ColumnIndex,
      monthOfYear: month.monthOfYear,
      calendarYear: month.calendarYear,
      verificationState: 'INCOMPLETE_UNVERIFIED_DRAFT_ATTENDANCE',
      classDays: applicableInstructionalDays.length,
      daysPresent,
      daysAbsent,
      daysTardy,
      daysExcused,
      missingInstructionalDates: [],
      unverifiedDraftDates,
      excusedDates,
      integrityErrors: [],
    };
  }

  if (daysExcused > 0 && excusedPolicy === 'UNRESOLVED') {
    return {
      sf9ColumnIndex: month.sf9ColumnIndex,
      monthOfYear: month.monthOfYear,
      calendarYear: month.calendarYear,
      verificationState: 'BLOCKED_PENDING_EXCUSED_POLICY',
      classDays: applicableInstructionalDays.length,
      daysPresent,
      daysAbsent,
      daysTardy,
      daysExcused,
      missingInstructionalDates: [],
      unverifiedDraftDates: [],
      excusedDates,
      integrityErrors: [],
    };
  }

  return {
    sf9ColumnIndex: month.sf9ColumnIndex,
    monthOfYear: month.monthOfYear,
    calendarYear: month.calendarYear,
    verificationState: 'VERIFIED',
    classDays: applicableInstructionalDays.length,
    daysPresent,
    daysAbsent,
    daysTardy,
    daysExcused,
    missingInstructionalDates: [],
    unverifiedDraftDates: [],
    excusedDates: [],
    integrityErrors: [],
  };
}

export type CalulutSf9AttendanceMappingResult =
  | {
      readyForOfficialSf9: true;
      attendance: Sf9Attendance;
      /**
       * Data-entry cells on `'ATTENDANCE RECORD SUMMARY'` (`sheet7.xml`):
       * - `F117:P117` (monthly school days) & `E117` (total school days `=SUM(F117:P117)`)
       * - `F14:P14` (Learner 1 monthly days present)
       */
      summarySheetCells: Record<string, number>;
      /**
       * Visible report-card cells on `'SF9 - GRADE 4-10'` (`sheet6.xml`):
       * - `R5:AB5` (No. of Class Days) & `AC5` (`=SUM(R5:AB6)`)
       * - `R7:AB7` (No. of Days Present) & `AC7` (`=SUM(R7:AB8)`)
       * - `R9:AB9` (No. of Days Absent `=IF(R7="","",ABS(R5-R7))`) & `AC9` (`=ABS(AC5-AC7)`)
       */
      cellValues: Record<string, number>;
      totalClassDays: number;
      totalDaysPresent: number;
      totalDaysAbsent: number;
      totalDaysTardy: number;
    }
  | {
      readyForOfficialSf9: false;
      blockingReasons: string[];
      unverifiedMonths: Array<{
        sf9ColumnIndex: number;
        monthLabel: string;
        verificationState: Sf2MonthAggregationVerificationState;
        missingInstructionalDates: string[];
        unverifiedDraftDates: string[];
        excusedDates: string[];
        integrityErrors: string[];
      }>;
      attendance?: Sf9Attendance;
      summarySheetCells?: Record<string, number>;
      cellValues?: Record<string, number>;
      totalClassDays?: number;
      totalDaysPresent?: number;
      totalDaysAbsent?: number;
      totalDaysTardy?: number;
    };

/**
 * Maps 11 verified monthly SF2 summaries (`Jun..Apr`, indices `0..10`) to the exact
 * Calulut SF9 workbook coordinates:
 * - Data-entry sheet `'ATTENDANCE RECORD SUMMARY'`: `F117:P117` (school days), `E117` (total),
 *   and `F14:P14` (days present).
 * - Report-card sheet `'SF9 - GRADE 4-10'`: `R5:AB5` + `AC5` (No. of Class Days),
 *   `R7:AB7` + `AC7` (No. of Days Present), and `R9:AB9` + `AC9` (No. of Days Absent).
 * Refuses official SF9 generation if any month is unverified, has `DRAFT` attendance,
 * has missing attendance, or is blocked on `E` policy.
 */
export function mapVerifiedSf2SummariesToCalulutSf9Cells(
  monthlySummaries: Sf2MonthlyStudentSummary[],
  targetTerm: 'T1' | 'T2' | 'T3' = 'T3'
): CalulutSf9AttendanceMappingResult {
  const summaryBySlot = new Map<number, Sf2MonthlyStudentSummary>();
  const blockingReasons: string[] = [];
  const unverifiedMonths: Array<{
    sf9ColumnIndex: number;
    monthLabel: string;
    verificationState: Sf2MonthAggregationVerificationState;
    missingInstructionalDates: string[];
    unverifiedDraftDates: string[];
    excusedDates: string[];
    integrityErrors: string[];
  }> = [];

  for (const summary of monthlySummaries) {
    if (summaryBySlot.has(summary.sf9ColumnIndex)) {
      blockingReasons.push(`Duplicate monthly summary for sf9ColumnIndex=${summary.sf9ColumnIndex}`);
      continue;
    }
    summaryBySlot.set(summary.sf9ColumnIndex, summary);
  }

  const classDays: (number | null)[] = Array(11).fill(null);
  const present: (number | null)[] = Array(11).fill(null);
  const summarySheetCells: Record<string, number> = {};
  const cellValues: Record<string, number> = {};
  let totalClassDays = 0;
  let totalDaysPresent = 0;
  let totalDaysAbsent = 0;
  let totalDaysTardy = 0;

  // T1 requires slots 0..3 (Jun..Sep); T2 requires slots 0..7 (Jun..Jan); T3 requires all 11 slots (0..10)
  const maxSlotIndex = targetTerm === 'T1' ? 3 : targetTerm === 'T2' ? 7 : 10;

  for (const slot of CALULUT_SF9_MONTH_SLOTS) {
    // If the month slot is beyond the target release term, it remains blank in the official SF9
    // and is not treated as missing attendance or unverified
    if (slot.index > maxSlotIndex) {
      classDays[slot.index] = null;
      present[slot.index] = null;
      continue;
    }

    const summary = summaryBySlot.get(slot.index);
    if (!summary) {
      blockingReasons.push(`Missing SchoolCalendarMonth summary for ${slot.label} (slot ${slot.index}).`);
      unverifiedMonths.push({
        sf9ColumnIndex: slot.index,
        monthLabel: slot.label,
        verificationState: 'INCOMPLETE_CALENDAR_NOT_FINALIZED',
        missingInstructionalDates: [],
        unverifiedDraftDates: [],
        excusedDates: [],
        integrityErrors: [`Missing summary for ${slot.label}`],
      });
      continue;
    }

    if (summary.verificationState !== 'VERIFIED') {
      blockingReasons.push(
        `Month ${slot.label} is not verified: ${summary.verificationState}`
      );
      unverifiedMonths.push({
        sf9ColumnIndex: slot.index,
        monthLabel: slot.label,
        verificationState: summary.verificationState,
        missingInstructionalDates: summary.missingInstructionalDates,
        unverifiedDraftDates: summary.unverifiedDraftDates,
        excusedDates: summary.excusedDates,
        integrityErrors: summary.integrityErrors,
      });
      continue;
    }

    if (summary.daysPresent + summary.daysAbsent !== summary.classDays) {
      blockingReasons.push(
        `Month ${slot.label} arithmetic mismatch: daysPresent (${summary.daysPresent}) + daysAbsent (${summary.daysAbsent}) !== classDays (${summary.classDays}).`
      );
      continue;
    }

    classDays[slot.index] = summary.classDays;
    present[slot.index] = summary.daysPresent;

    // Data-entry sheet ('ATTENDANCE RECORD SUMMARY'): F117:P117 and F14:P14
    summarySheetCells[`${slot.summaryColumn}${CALULUT_SF9_ATTENDANCE_CELLS.summaryClassDaysRow}`] =
      summary.classDays;
    summarySheetCells[`${slot.summaryColumn}${CALULUT_SF9_ATTENDANCE_CELLS.summaryDaysPresentRow}`] =
      summary.daysPresent;

    // Report-card sheet ('SF9 - GRADE 4-10'): R5:AB5, R7:AB7, R9:AB9
    cellValues[`${slot.sf9Column}${CALULUT_SF9_ATTENDANCE_CELLS.classDaysRow}`] = summary.classDays;
    cellValues[`${slot.sf9Column}${CALULUT_SF9_ATTENDANCE_CELLS.daysPresentRow}`] = summary.daysPresent;
    cellValues[`${slot.sf9Column}${CALULUT_SF9_ATTENDANCE_CELLS.daysAbsentRow}`] = summary.daysAbsent;

    totalClassDays += summary.classDays;
    totalDaysPresent += summary.daysPresent;
    totalDaysAbsent += summary.daysAbsent;
    totalDaysTardy += summary.daysTardy;
  }

  summarySheetCells[CALULUT_SF9_ATTENDANCE_CELLS.summaryTotalClassDaysCell] = totalClassDays;

  cellValues[CALULUT_SF9_ATTENDANCE_CELLS.totalClassDaysCell] = totalClassDays;
  cellValues[CALULUT_SF9_ATTENDANCE_CELLS.totalDaysPresentCell] = totalDaysPresent;
  cellValues[CALULUT_SF9_ATTENDANCE_CELLS.totalDaysAbsentCell] = totalDaysAbsent;

  if (blockingReasons.length > 0 || unverifiedMonths.length > 0) {
    return {
      readyForOfficialSf9: false,
      blockingReasons,
      unverifiedMonths,
      attendance: {
        classDays: classDays as any,
        present: present as any,
      },
      summarySheetCells,
      cellValues,
      totalClassDays,
      totalDaysPresent,
      totalDaysAbsent,
      totalDaysTardy,
    };
  }

  summarySheetCells[CALULUT_SF9_ATTENDANCE_CELLS.summaryTotalClassDaysCell] = totalClassDays;

  cellValues[CALULUT_SF9_ATTENDANCE_CELLS.totalClassDaysCell] = totalClassDays;
  cellValues[CALULUT_SF9_ATTENDANCE_CELLS.totalDaysPresentCell] = totalDaysPresent;
  cellValues[CALULUT_SF9_ATTENDANCE_CELLS.totalDaysAbsentCell] = totalDaysAbsent;

  return {
    readyForOfficialSf9: true,
    attendance: {
      classDays: classDays as any,
      present: present as any,
    },
    summarySheetCells,
    cellValues,
    totalClassDays,
    totalDaysPresent,
    totalDaysAbsent,
    totalDaysTardy,
  };
}

// ─── 6. Protected Published Grades & Optimistic Concurrency Helpers ─────────

export interface GradePublicationSnapshotInput {
  enrollmentId: string;
  subjectId: string;
  term: 1 | 2 | 3;
  gradebookId: string;
  currentGradebookStatus: 'Draft' | 'Submitted' | 'Verified' | 'Published';
  currentGradebookVersion: number;
  expectedGradebookVersion: number;
  transmutedTermGrade: number; // Must be integer 60..100
  initialGrade: number;        // 0..100 (stored as Decimal(5,2))
  publishedById: string;
  isRepublicationCorrection: boolean;
  correctionReason?: string | null;
}

export interface GradePublicationValidationResult {
  valid: boolean;
  code?:
    | 'OPTIMISTIC_LOCK_VERSION_CONFLICT'
    | 'INVALID_PUBLISHED_TERM_GRADE_INTEGER'
    | 'PUBLISHED_TERM_GRADE_OUT_OF_RANGE'
    | 'INITIAL_GRADE_OUT_OF_RANGE'
    | 'MISSING_CORRECTION_REASON_FOR_REPUBLICATION';
  message?: string;
  normalizedPublishedSnapshot?: {
    publishedTermGrade: number; // Int (SmallInt 60..100)
    publishedInitialGradeFixed2: string; // Decimal(5,2) representation
    publishedGradebookId: string;
    publishedVersion: number;
    publishedById: string;
    publicationCorrectionReason: string | null;
  };
}

/**
 * Prepared validation helper for grade publication snapshots (pending post-migration
 * integration into `ledger.service.ts` / grade publication service):
 * - Enforces optimistic concurrency (`expectedGradebookVersion === currentGradebookVersion`).
 * - Enforces that `transmutedTermGrade` is an exact integer in `60..100`
 *   (`published_term_grade Int? @db.SmallInt`), eliminating `Float` drift.
 * - Requires a non-empty `correctionReason` when republishing/correcting an
 *   already published gradebook.
 */
export function validateGradePublicationSnapshot(
  input: GradePublicationSnapshotInput
): GradePublicationValidationResult {
  if (input.expectedGradebookVersion !== input.currentGradebookVersion) {
    return {
      valid: false,
      code: 'OPTIMISTIC_LOCK_VERSION_CONFLICT',
      message: `Optimistic concurrency conflict on Gradebook ${input.gradebookId}: expected version ${input.expectedGradebookVersion}, actual version ${input.currentGradebookVersion}.`,
    };
  }

  if (!Number.isInteger(input.transmutedTermGrade)) {
    return {
      valid: false,
      code: 'INVALID_PUBLISHED_TERM_GRADE_INTEGER',
      message: `published_term_grade must be an exact integer (SmallInt), received non-integer ${input.transmutedTermGrade}.`,
    };
  }

  if (input.transmutedTermGrade < 60 || input.transmutedTermGrade > 100) {
    return {
      valid: false,
      code: 'PUBLISHED_TERM_GRADE_OUT_OF_RANGE',
      message: `published_term_grade must be between 60 and 100 inclusive (DepEd transmuted range), received ${input.transmutedTermGrade}.`,
    };
  }

  if (!Number.isFinite(input.initialGrade) || input.initialGrade < 0 || input.initialGrade > 100) {
    return {
      valid: false,
      code: 'INITIAL_GRADE_OUT_OF_RANGE',
      message: `published_initial_grade must be between 0.00 and 100.00, received ${input.initialGrade}.`,
    };
  }

  const trimmedReason = input.correctionReason?.trim() ?? '';
  if (input.isRepublicationCorrection && trimmedReason.length < 5) {
    return {
      valid: false,
      code: 'MISSING_CORRECTION_REASON_FOR_REPUBLICATION',
      message:
        'A documented correctionReason (at least 5 characters) is required when republishing or correcting a Published grade.',
    };
  }

  return {
    valid: true,
    normalizedPublishedSnapshot: {
      publishedTermGrade: input.transmutedTermGrade,
      publishedInitialGradeFixed2: input.initialGrade.toFixed(2),
      publishedGradebookId: input.gradebookId,
      publishedVersion: input.currentGradebookVersion + 1,
      publishedById: input.publishedById,
      publicationCorrectionReason: input.isRepublicationCorrection ? trimmedReason : null,
    },
  };
}

/**
 * Prepared guard helper to prevent draft score saving (`saveLedger`) from modifying
 * or overwriting a `Gradebook` that is already `Published` unless it has been
 * explicitly reopened through an audited workflow. Also enforces optimistic version matching.
 */
export function assertGradebookWritableForDraftSave(params: {
  gradebookId: string;
  status: 'Draft' | 'Submitted' | 'Verified' | 'Published';
  currentVersion: number;
  expectedVersion: number;
}): { writable: boolean; code?: 'GRADEBOOK_LOCKED_PUBLISHED' | 'OPTIMISTIC_LOCK_VERSION_CONFLICT'; message?: string } {
  if (params.status === 'Published') {
    return {
      writable: false,
      code: 'GRADEBOOK_LOCKED_PUBLISHED',
      message: `Gradebook ${params.gradebookId} is Published and locked. Draft saves cannot overwrite published term grades without an audited reopen/republication.`,
    };
  }

  if (params.currentVersion !== params.expectedVersion) {
    return {
      writable: false,
      code: 'OPTIMISTIC_LOCK_VERSION_CONFLICT',
      message: `Gradebook ${params.gradebookId} version mismatch: expected ${params.expectedVersion}, actual ${params.currentVersion}.`,
    };
  }

  return { writable: true };
}

// ─── 7. Adviser Authorization, Comments & SF9 Issuance Guards ───────────────

export type Sf2Sf9ActorRole = 'Teacher' | 'Admin' | 'Registrar' | 'Student';

export interface AuthorizedActorContext {
  userId: string;
  role: Sf2Sf9ActorRole;
}

/**
 * Enforces role & ownership boundaries for official daily attendance and
 * adviser term remarks:
 * - Only the assigned Class Adviser (`section.adviserId === actor.userId` or
 *   an active `SectionAdviserAssignment` for the date) or `Admin`/`Registrar`
 *   with an explicit override reason may record official SF2 attendance or
 *   publish adviser term comments.
 * - Subject teachers who are not the section's Class Adviser are denied.
 */
export function authorizeSectionAdviserOrOverride(params: {
  actor: AuthorizedActorContext;
  section: SectionRef;
  activeAdviserIdsForDate?: string[];
  overrideReason?: string | null;
}): { authorized: boolean; isOverride: boolean; reason?: string } {
  const { actor, section, activeAdviserIdsForDate = [], overrideReason } = params;

  const isAssignedAdviser =
    section.adviserId === actor.userId || activeAdviserIdsForDate.includes(actor.userId);

  if (actor.role === 'Teacher' && isAssignedAdviser) {
    return { authorized: true, isOverride: false };
  }

  if (actor.role === 'Admin' || actor.role === 'Registrar') {
    if (isAssignedAdviser) {
      return { authorized: true, isOverride: false };
    }
    const trimmed = overrideReason?.trim() ?? '';
    if (trimmed.length >= 5) {
      return { authorized: true, isOverride: true };
    }
    return {
      authorized: false,
      isOverride: false,
      reason:
        'Admin/Registrar override for section attendance or adviser comments requires an explicit overrideReason (minimum 5 characters).',
    };
  }

  return {
    authorized: false,
    isOverride: false,
    reason: `User ${actor.userId} (${actor.role}) is not the assigned Class Adviser for section ${section.name}.`,
  };
}

export interface Sf9AdviserTermCommentRecord {
  enrollmentId: string;
  studentId: string;
  sectionId: string;
  academicYearId: string;
  term: 1 | 2 | 3;
  commentText: string;
  status: AdviserCommentStatus;
}

/**
 * Maps `Sf9AdviserTermCommentRecord` rows to the exact Calulut SF9 Excel comment cells:
 * - Data-entry cells on `'TEACHERS COMMENTS'` (`sheet8.xml`): `F14` (Term 1), `J14` (Term 2), `O14` (Term 3).
 * - Visible destination cells on `'SF9 - GRADE 4-10'` (`sheet6.xml`): `R15` (Term 1, merged `R15:AC18`),
 *   `R19` (Term 2, merged `R19:AC22`), `R23` (Term 3, merged `R23:AC26`).
 * - For official SF9 issuance (`mode === 'OFFICIAL'`), only `PUBLISHED` comments
 *   matching the exact `(enrollmentId, studentId, sectionId, academicYearId)`
 *   are emitted; `DRAFT` comments are never leaked into official reports.
 */
export function resolveSf9AdviserCommentsForCells(params: {
  enrollment: EnrollmentRef;
  comments: Sf9AdviserTermCommentRecord[];
  mode: 'DRAFT_PREVIEW' | 'OFFICIAL';
}): {
  sf9Comments: Sf9Comments;
  entryCellValues: Record<'F14' | 'J14' | 'O14', string>;
  cellValues: Record<'R15' | 'R19' | 'R23', string>;
  integrityErrors: string[];
} {
  const { enrollment, comments, mode } = params;
  const integrityErrors: string[] = [];
  const byTerm: Record<1 | 2 | 3, string> = { 1: '', 2: '', 3: '' };

  for (const c of comments) {
    if (
      c.enrollmentId !== enrollment.id ||
      c.studentId !== enrollment.studentId ||
      c.sectionId !== enrollment.sectionId ||
      c.academicYearId !== enrollment.academicYearId
    ) {
      integrityErrors.push(
        `Adviser comment term ${c.term} failed cross-record student/enrollment/section isolation check.`
      );
      continue;
    }

    if (mode === 'OFFICIAL' && c.status !== 'PUBLISHED') {
      continue;
    }

    byTerm[c.term] = c.commentText.trim();
  }

  return {
    sf9Comments: {
      t1: byTerm[1],
      t2: byTerm[2],
      t3: byTerm[3],
    },
    entryCellValues: {
      F14: byTerm[1],
      J14: byTerm[2],
      O14: byTerm[3],
    },
    cellValues: {
      R15: byTerm[1],
      R19: byTerm[2],
      R23: byTerm[3],
    },
    integrityErrors,
  };
}

export interface Sf9OfficialIssuanceRecordContract {
  id: string;
  enrollmentId: string;
  studentId: string;
  sectionId: string;
  academicYearId: string;
  versionNumber: number;
  status: Sf9IssuanceLifecycleStatus;
  isCurrent: boolean;
  templateSha256: string;
  xlsxSha256: string;
  pdfSha256: string;
  libreofficeVersion: string;
  issuedPdfDocumentId: string;
  frozenPayloadEncrypted: string;
  calculatedSummaryEncrypted: string;
  adviserSignatoryName: string;
  schoolHeadSignatoryName: string;
  issuedById: string;
  supersedesIssuanceId?: string | null;
  reissueReason?: string | null;
}

const SHA256_HEX_REGEX = /^[a-f0-9]{64}$/i;

/**
 * Validates an `Sf9OfficialIssuance` record against:
 * 1. Cross-record composite FK match `(enrollmentId, studentId, sectionId, academicYearId)`.
 * 2. Field-level encryption format (`v1.` prefix from `prisma-field-encryption`
 *    or non-plaintext encrypted ciphertext).
 * 3. SHA-256 checksum integrity for template, generated `.xlsx`, and archived `.pdf`.
 * 4. Supersession / append-only version progression (`versionNumber > 1` requires
 *    `supersedesIssuanceId` and a documented `reissueReason`).
 */
export function validateOfficialSf9IssuanceRecord(params: {
  issuance: Sf9OfficialIssuanceRecordContract;
  enrollment: EnrollmentRef;
  previousCurrentIssuance?: Sf9OfficialIssuanceRecordContract | null;
}): {
  valid: boolean;
  code?:
    | 'CROSS_STUDENT_ISOLATION_VIOLATION'
    | 'UNENCRYPTED_SENSITIVE_SNAPSHOT'
    | 'INVALID_ARTIFACT_SHA256'
    | 'INVALID_SUPERSESSION_CHAIN'
    | 'MISSING_ISSUED_PDF_DOCUMENT';
  message?: string;
} {
  const { issuance, enrollment, previousCurrentIssuance } = params;

  // 1. Cross-student / cross-section / cross-year isolation check
  if (
    issuance.enrollmentId !== enrollment.id ||
    issuance.studentId !== enrollment.studentId ||
    issuance.sectionId !== enrollment.sectionId ||
    issuance.academicYearId !== enrollment.academicYearId
  ) {
    return {
      valid: false,
      code: 'CROSS_STUDENT_ISOLATION_VIOLATION',
      message:
        'Sf9OfficialIssuance (enrollmentId, studentId, sectionId, academicYearId) does not match target Enrollment.',
    };
  }

  // 2. Ensure snapshots are encrypted (not raw JSON plaintext)
  const looksLikeRawJson = (val: string) => {
    const trimmed = val.trim();
    return trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.length < 16;
  };
  if (
    looksLikeRawJson(issuance.frozenPayloadEncrypted) ||
    looksLikeRawJson(issuance.calculatedSummaryEncrypted)
  ) {
    return {
      valid: false,
      code: 'UNENCRYPTED_SENSITIVE_SNAPSHOT',
      message:
        'frozenPayloadEncrypted and calculatedSummaryEncrypted must be field-encrypted ciphertext (@encrypted?mode=strict), never raw JSON.',
    };
  }

  // 3. Validate SHA-256 digests & archived PDF document reference
  if (
    !SHA256_HEX_REGEX.test(issuance.templateSha256) ||
    !SHA256_HEX_REGEX.test(issuance.xlsxSha256) ||
    !SHA256_HEX_REGEX.test(issuance.pdfSha256)
  ) {
    return {
      valid: false,
      code: 'INVALID_ARTIFACT_SHA256',
      message: 'templateSha256, xlsxSha256, and pdfSha256 must be valid 64-character hex SHA-256 digests.',
    };
  }

  if (!issuance.issuedPdfDocumentId || issuance.issuedPdfDocumentId.trim().length === 0) {
    return {
      valid: false,
      code: 'MISSING_ISSUED_PDF_DOCUMENT',
      message: 'issuedPdfDocumentId is required to preserve the exact rendered PDF bytes against LibreOffice/font drift.',
    };
  }

  // 4. Validate append-only supersession chain
  if (issuance.versionNumber === 1) {
    if (previousCurrentIssuance || issuance.supersedesIssuanceId) {
      return {
        valid: false,
        code: 'INVALID_SUPERSESSION_CHAIN',
        message: 'Version 1 issuance cannot supersede an existing issuance.',
      };
    }
  } else {
    if (
      !previousCurrentIssuance ||
      issuance.supersedesIssuanceId !== previousCurrentIssuance.id ||
      issuance.versionNumber !== previousCurrentIssuance.versionNumber + 1 ||
      (issuance.reissueReason?.trim().length ?? 0) < 5
    ) {
      return {
        valid: false,
        code: 'INVALID_SUPERSESSION_CHAIN',
        message:
          'Reissued SF9 must increment versionNumber by 1, reference supersedesIssuanceId of the prior current issuance, and include a reissueReason.',
      };
    }
  }

  return { valid: true };
}
