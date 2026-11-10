/**
 * DIGISKWELA — Phase G / G.1 Unit & Negative Validation Test Suite
 * Module: tests/calulutSf9PhaseGPreparation.unit.test.ts
 *
 * Verifies:
 * 1. Reconciled Calulut SF9 Excel cell mappings against `master_template_sanitized.xlsx`,
 *    generated `.xlsx` OpenXML formulas/values, and LibreOffice PDF rendering:
 *    - School days: `'ATTENDANCE RECORD SUMMARY'!F117:P117` + `E117` -> `'SF9 - GRADE 4-10'!R5:AB5` + `AC5`
 *    - Days present: `'ATTENDANCE RECORD SUMMARY'!F14:P14` -> `'SF9 - GRADE 4-10'!R7:AB7` + `AC7`
 *    - Days absent: Formula `'SF9 - GRADE 4-10'!R9:AB9` (`=IF(R7="","",ABS(R5-R7))`) + `AC9` (`=ABS(AC5-AC7)`)
 *    - Adviser comments: `'TEACHERS COMMENTS'!F14`, `J14`, `O14` -> `'SF9 - GRADE 4-10'!R15`, `R19`, `R23`
 *    - Signatories: `'INPUT DATA'!F19`, `F26` -> `'SF9 - GRADE 4-10'!B27`, `H27`, `X40`, `Q41`, `Q49`
 *    - Grades & General Average: `'TERM 1..3 SUMMARY'!K15:T15` -> `'SF9 - GRADE 4-10'!F32:H41`, `I32:I39`, `I42`, `J42`
 * 2. Aligned `OfficialAttendanceRecordStatus` (`DRAFT` | `VERIFIED` | `INVALIDATED_NON_INSTRUCTIONAL`):
 *    - Only `VERIFIED` rows count toward official SF9 attendance
 *    - `DRAFT` rows are rejected for official SF9 (`INCOMPLETE_UNVERIFIED_DRAFT_ATTENDANCE`)
 *    - `INVALIDATED_NON_INSTRUCTIONAL` rows are excluded from instructional day counts
 *    - Missing instructional days return `INCOMPLETE_MISSING_ATTENDANCE`
 *    - Unresolved `E` (`Excused`) returns `BLOCKED_PENDING_EXCUSED_POLICY`
 * 3. Cross-record relationship integrity & negative contradiction rejection
 * 4. Published grade integer enforcement (60..100) & optimistic concurrency locking helpers
 * 5. Official SF9 Issuance encryption, SHA-256 checksums, supersession & student isolation
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import AdmZip from 'adm-zip';
import {
  CALULUT_SF9_MONTH_SLOTS,
  CALULUT_SF9_ATTENDANCE_CELLS,
  CALULUT_SF9_COMMENT_CELLS,
  CALULUT_SF9_SIGNATORY_CELLS,
  CALULUT_SF9_GRADE_CELLS,
  DEFAULT_MASTER_TEMPLATE_PATH,
  parseManilaDateOnly,
  enumerateDatesInMonth,
  validateCalendarMonthDefinition,
  validateCalendarDayRelationship,
  validateSectionCalendarExceptionRelationship,
  validateOfficialDailyAttendanceRelationship,
  evaluateCalendarMonthCompleteness,
  planCalendarDayReclassificationImpact,
  aggregateStudentMonthlyAttendanceForSf9,
  mapVerifiedSf2SummariesToCalulutSf9Cells,
  validateGradePublicationSnapshot,
  assertGradebookWritableForDraftSave,
  authorizeSectionAdviserOrOverride,
  resolveSf9AdviserCommentsForCells,
  validateOfficialSf9IssuanceRecord,
  generateCalulutSf9,
  getSyntheticSf9Data,
  renderCalulutSf9BufferToPdf,
  type AcademicYearRef,
  type SectionRef,
  type EnrollmentRef,
  type SchoolCalendarMonthRecord,
  type SchoolCalendarDayRecord,
  type SectionCalendarExceptionRecord,
  type OfficialDailyAttendanceRecord,
} from '../src/academic/grading/index.js';

// ─── Test Fixtures ──────────────────────────────────────────────────────────

const AY_2025_2026: AcademicYearRef = {
  id: 'ay-2025-2026',
  year: '2025-2026',
  startDate: '2025-06-01',
  endDate: '2026-04-30',
};

const SECTION_RIZAL: SectionRef = {
  id: 'sec-g7-rizal',
  academicYearId: 'ay-2025-2026',
  adviserId: 'teacher-adviser-1',
  gradeLevel: 7,
  name: 'Rizal',
};

const ENROLLMENT_STUDENT_A: EnrollmentRef = {
  id: 'enr-student-a',
  studentId: 'stu-a',
  sectionId: 'sec-g7-rizal',
  academicYearId: 'ay-2025-2026',
  status: 'Active',
};

const MONTH_JUNE_2025: SchoolCalendarMonthRecord = {
  id: 'cal-month-2025-06',
  academicYearId: 'ay-2025-2026',
  calendarYear: 2025,
  monthOfYear: 6,
  sf9ColumnIndex: 0,
  status: 'FINALIZED',
};

function buildCompleteCalendarDaysForMonth(
  month: SchoolCalendarMonthRecord,
  holidayDates: string[] = []
): SchoolCalendarDayRecord[] {
  const dates = enumerateDatesInMonth(month.calendarYear, month.monthOfYear);
  const holidaySet = new Set(holidayDates);

  return dates.map((isoDate) => {
    const [y, m, d] = isoDate.split('-').map(Number);
    const dayOfWeek = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isHoliday = holidaySet.has(isoDate);

    const dayKind = isWeekend
      ? 'WEEKEND'
      : isHoliday
        ? 'REGULAR_HOLIDAY'
        : 'INSTRUCTIONAL';

    return {
      id: `cal-day-${isoDate}`,
      academicYearId: month.academicYearId,
      calendarMonthId: month.id,
      date: isoDate,
      dayKind,
      isInstructional: dayKind === 'INSTRUCTIONAL',
      reason: isHoliday ? 'Independence Day' : null,
    };
  });
}

function readCellFromXml(xml: string, cellRef: string): { formula: string | null; value: string | null; typeAttr: string | null } {
  const cellRegex = new RegExp(`<c r="${cellRef}"([^>]*?)>([\\s\\S]*?)<\\/c>`);
  const match = cellRegex.exec(xml);
  if (!match) {
    return { formula: null, value: null, typeAttr: null };
  }
  const attrs = match[1];
  const body = match[2];
  const typeMatch = /\st="([^"]+)"/.exec(attrs);
  const fMatch = /<f[^>]*>([\s\S]*?)<\/f>/.exec(body);
  const vMatch = /<v[^>]*>([\s\S]*?)<\/v>/.exec(body);
  return {
    formula: fMatch ? fMatch[1] : null,
    value: vMatch ? vMatch[1] : null,
    typeAttr: typeMatch ? typeMatch[1] : null,
  };
}

// ─── Suite 1: Reconciled Calulut Workbook Cell Mappings & PDF Verification ──

describe('Phase G.1 Section 1 — Reconciled Calulut SF9 Workbook Cell Mappings & PDF Verification', () => {
  it('defines exact Calulut workbook coordinates for Attendance, Adviser Comments, Signatories, and Grades', () => {
    // 1. Attendance coordinates
    expect(CALULUT_SF9_MONTH_SLOTS.map((s) => s.summaryColumn)).toEqual([
      'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P',
    ]);
    expect(CALULUT_SF9_MONTH_SLOTS.map((s) => s.sf9Column)).toEqual([
      'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'AA', 'AB',
    ]);
    expect(CALULUT_SF9_ATTENDANCE_CELLS).toEqual({
      summarySheet: 'ATTENDANCE RECORD SUMMARY',
      summaryClassDaysRow: 117,
      summaryTotalClassDaysCell: 'E117',
      summaryDaysPresentRow: 14,
      sf9Sheet: 'SF9 - GRADE 4-10',
      monthHeaderRow: 4,
      classDaysRow: 5,
      daysPresentRow: 7,
      daysAbsentRow: 9,
      totalColumn: 'AC',
      totalClassDaysCell: 'AC5',
      totalDaysPresentCell: 'AC7',
      totalDaysAbsentCell: 'AC9',
    });

    // 2. Adviser Comment coordinates
    expect(CALULUT_SF9_COMMENT_CELLS.entryCells).toEqual({
      1: 'F14',
      2: 'J14',
      3: 'O14',
    });
    expect(CALULUT_SF9_COMMENT_CELLS.sf9Cells).toEqual({
      1: 'R15',
      2: 'R19',
      3: 'R23',
    });

    // 3. Signatory coordinates
    expect(CALULUT_SF9_SIGNATORY_CELLS.inputDataCells).toEqual({
      schoolHeadName: 'F19',
      adviserName: 'F26',
    });
    expect(CALULUT_SF9_SIGNATORY_CELLS.sf9Cells).toEqual({
      schoolHeadLetter: 'B27',
      adviserLetter: 'H27',
      adviserCertificateOfTransfer: 'X40',
      schoolHeadCertificateOfTransfer: 'Q41',
      schoolHeadCancellationOfTransfer: 'Q49',
    });

    // 4. Learning Area Grade & General Average coordinates
    expect(CALULUT_SF9_GRADE_CELLS.generalAverageCell).toBe('I42');
    expect(CALULUT_SF9_GRADE_CELLS.generalRemarksCell).toBe('J42');
    expect(CALULUT_SF9_GRADE_CELLS.sf9SubjectRows).toEqual({
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
    });
  });

  it('verifies every mapped cell and formula against the actual Calulut master_template_sanitized.xlsx and generated .xlsx + rendered PDF', async () => {
    // 1. Map 11 verified monthly SF2 summaries with distinct custom classDays and present counts
    const customClassDays = [16, 21, 20, 20, 20, 20, 20, 18, 18, 20, 7]; // Total = 200
    const customPresent =   [15, 20, 19, 20, 19, 20, 20, 17, 18, 19, 7]; // Total = 194, Absent = 6

    const summaries = CALULUT_SF9_MONTH_SLOTS.map((slot, idx) => ({
      sf9ColumnIndex: slot.index,
      monthOfYear: slot.monthOfYear,
      calendarYear: slot.monthOfYear >= 6 ? 2025 : 2026,
      verificationState: 'VERIFIED' as const,
      classDays: customClassDays[idx],
      daysPresent: customPresent[idx],
      daysAbsent: customClassDays[idx] - customPresent[idx],
      daysTardy: 1,
      daysExcused: 0,
      missingInstructionalDates: [],
      unverifiedDraftDates: [],
      excusedDates: [],
      integrityErrors: [],
    }));

    const mappedAtt = mapVerifiedSf2SummariesToCalulutSf9Cells(summaries);
    expect(mappedAtt.readyForOfficialSf9).toBe(true);
    if (!mappedAtt.readyForOfficialSf9) return;

    // Verify data-entry cells on 'ATTENDANCE RECORD SUMMARY' (F117:P117, E117, F14:P14)
    expect(mappedAtt.summarySheetCells.F117).toBe(16);
    expect(mappedAtt.summarySheetCells.G117).toBe(21);
    expect(mappedAtt.summarySheetCells.P117).toBe(7);
    expect(mappedAtt.summarySheetCells.E117).toBe(200);
    expect(mappedAtt.summarySheetCells.F14).toBe(15);
    expect(mappedAtt.summarySheetCells.G14).toBe(20);
    expect(mappedAtt.summarySheetCells.P14).toBe(7);

    // Verify visible destination cells on 'SF9 - GRADE 4-10' (R5:AB5, AC5, R7:AB7, AC7, R9:AB9, AC9)
    expect(mappedAtt.cellValues.R5).toBe(16);
    expect(mappedAtt.cellValues.S5).toBe(21);
    expect(mappedAtt.cellValues.AB5).toBe(7);
    expect(mappedAtt.cellValues.AC5).toBe(200);

    expect(mappedAtt.cellValues.R7).toBe(15);
    expect(mappedAtt.cellValues.S7).toBe(20);
    expect(mappedAtt.cellValues.AB7).toBe(7);
    expect(mappedAtt.cellValues.AC7).toBe(194);

    expect(mappedAtt.cellValues.R9).toBe(1);
    expect(mappedAtt.cellValues.S9).toBe(1);
    expect(mappedAtt.cellValues.AB9).toBe(0);
    expect(mappedAtt.cellValues.AC9).toBe(6);

    // 2. Map 3 PUBLISHED adviser comments
    const resolvedComments = resolveSf9AdviserCommentsForCells({
      enrollment: ENROLLMENT_STUDENT_A,
      mode: 'OFFICIAL',
      comments: [
        {
          enrollmentId: ENROLLMENT_STUDENT_A.id,
          studentId: ENROLLMENT_STUDENT_A.studentId,
          sectionId: SECTION_RIZAL.id,
          academicYearId: AY_2025_2026.id,
          term: 1,
          commentText: 'Term 1 Verified Adviser Remark.',
          status: 'PUBLISHED',
        },
        {
          enrollmentId: ENROLLMENT_STUDENT_A.id,
          studentId: ENROLLMENT_STUDENT_A.studentId,
          sectionId: SECTION_RIZAL.id,
          academicYearId: AY_2025_2026.id,
          term: 2,
          commentText: 'Term 2 Verified Adviser Remark.',
          status: 'PUBLISHED',
        },
        {
          enrollmentId: ENROLLMENT_STUDENT_A.id,
          studentId: ENROLLMENT_STUDENT_A.studentId,
          sectionId: SECTION_RIZAL.id,
          academicYearId: AY_2025_2026.id,
          term: 3,
          commentText: 'Term 3 Verified Adviser Remark.',
          status: 'PUBLISHED',
        },
      ],
    });

    expect(resolvedComments.entryCellValues).toEqual({
      F14: 'Term 1 Verified Adviser Remark.',
      J14: 'Term 2 Verified Adviser Remark.',
      O14: 'Term 3 Verified Adviser Remark.',
    });
    expect(resolvedComments.cellValues).toEqual({
      R15: 'Term 1 Verified Adviser Remark.',
      R19: 'Term 2 Verified Adviser Remark.',
      R23: 'Term 3 Verified Adviser Remark.',
    });

    // 3. Generate populated Calulut SF9 workbook and inspect OpenXML cells & formulas
    const baseData = getSyntheticSf9Data();
    const genResult = generateCalulutSf9({
      ...baseData.payload,
      demographics: {
        ...baseData.payload.demographics,
        schoolHead: 'DR. ELENA M. SANTOS',
        adviser: 'PROF. CARLOS D. REYES',
      },
      attendance: mappedAtt.attendance,
      comments: resolvedComments.sf9Comments,
    });

    expect(genResult.success).toBe(true);
    if (!genResult.success) return;

    const zip = new AdmZip(genResult.buffer);
    const s7Xml = zip.readAsText('xl/worksheets/sheet7.xml'); // ATTENDANCE RECORD SUMMARY
    const s6Xml = zip.readAsText('xl/worksheets/sheet6.xml'); // SF9 - GRADE 4-10

    // Verify 'ATTENDANCE RECORD SUMMARY'!F117:P117, E117, and F14:P14
    expect(readCellFromXml(s7Xml, 'F117').value).toBe('16');
    expect(readCellFromXml(s7Xml, 'G117').value).toBe('21');
    expect(readCellFromXml(s7Xml, 'P117').value).toBe('7');
    expect(readCellFromXml(s7Xml, 'E117').formula).toBe('SUM(F117:P117)');
    expect(readCellFromXml(s7Xml, 'E117').value).toBe('200');
    expect(readCellFromXml(s7Xml, 'F14').value).toBe('15');
    expect(readCellFromXml(s7Xml, 'G14').value).toBe('20');
    expect(readCellFromXml(s7Xml, 'P14').value).toBe('7');

    // Verify 'SF9 - GRADE 4-10' attendance formulas and cached <v> values are preserved
    expect(readCellFromXml(s6Xml, 'R5').formula).toBe("'ATTENDANCE RECORD SUMMARY'!F117");
    expect(readCellFromXml(s6Xml, 'R5').value).toBe('16');
    expect(readCellFromXml(s6Xml, 'AB5').formula).toBe("'ATTENDANCE RECORD SUMMARY'!P117");
    expect(readCellFromXml(s6Xml, 'AB5').value).toBe('7');
    expect(readCellFromXml(s6Xml, 'AC5').formula).toBe('SUM(R5:AB6)');
    expect(readCellFromXml(s6Xml, 'AC5').value).toBe('200');

    expect(readCellFromXml(s6Xml, 'R7').formula).toContain('VLOOKUP(C17');
    expect(readCellFromXml(s6Xml, 'R7').value).toBe('15');
    expect(readCellFromXml(s6Xml, 'AC7').formula).toBe('SUM(R7:AB8)');
    expect(readCellFromXml(s6Xml, 'AC7').value).toBe('194');

    expect(readCellFromXml(s6Xml, 'R9').formula).toBe('IF(R7="","",ABS(R5-R7))');
    expect(readCellFromXml(s6Xml, 'R9').value).toBe('1');
    expect(readCellFromXml(s6Xml, 'AC9').formula).toBe('ABS(AC5-AC7)');
    expect(readCellFromXml(s6Xml, 'AC9').value).toBe('6');

    // Verify 'SF9 - GRADE 4-10' adviser comments R15, R19, R23 preserve VLOOKUP formulas
    expect(readCellFromXml(s6Xml, 'R15').formula).toContain("'TEACHERS COMMENTS'!C14:O114,4,0");
    expect(readCellFromXml(s6Xml, 'R15').value).toBe('Term 1 Verified Adviser Remark.');
    expect(readCellFromXml(s6Xml, 'R19').formula).toContain("'TEACHERS COMMENTS'!C14:O114,8,0");
    expect(readCellFromXml(s6Xml, 'R19').value).toBe('Term 2 Verified Adviser Remark.');
    expect(readCellFromXml(s6Xml, 'R23').formula).toContain("'TEACHERS COMMENTS'!C14:O114,13,0");
    expect(readCellFromXml(s6Xml, 'R23').value).toBe('Term 3 Verified Adviser Remark.');

    // Verify 'SF9 - GRADE 4-10' signatory cells B27, H27, X40, Q41, Q49 preserve 'INPUT DATA' formulas
    expect(readCellFromXml(s6Xml, 'B27').formula).toBe("IF('INPUT DATA'!F19=\"\",'','INPUT DATA'!F19)".replace("''", '""'));
    expect(readCellFromXml(s6Xml, 'B27').value).toBe('DR. ELENA M. SANTOS');
    expect(readCellFromXml(s6Xml, 'Q41').value).toBe('DR. ELENA M. SANTOS');
    expect(readCellFromXml(s6Xml, 'Q49').value).toBe('DR. ELENA M. SANTOS');
    expect(readCellFromXml(s6Xml, 'H27').formula).toBe("IF('INPUT DATA'!F26=\"\",'','INPUT DATA'!F26)".replace("''", '""'));
    expect(readCellFromXml(s6Xml, 'H27').value).toBe('PROF. CARLOS D. REYES');
    expect(readCellFromXml(s6Xml, 'X40').value).toBe('PROF. CARLOS D. REYES');

    // Verify 'SF9 - GRADE 4-10' grades F32:H41, I32:I39, and General Average I42/J42
    expect(readCellFromXml(s6Xml, 'F34').formula).toContain("'TERM 1 SUMMARY'!$C$15:$U$115,11,0");
    expect(readCellFromXml(s6Xml, 'F34').value).toBe('91');
    expect(readCellFromXml(s6Xml, 'I34').value).toBe('93');
    expect(readCellFromXml(s6Xml, 'I42').formula).toBe('IF(COUNT(I32:I39)=0,"",ROUND(AVERAGE(I32:I39),0))');
    expect(readCellFromXml(s6Xml, 'I42').value).toBe('90');
    expect(readCellFromXml(s6Xml, 'J42').value).toBe('Passed');

    // 4. Render populated workbook to PDF through headless LibreOffice Calc (cachePolicy: 'no-store')
    const pdfBuffer = await renderCalulutSf9BufferToPdf(genResult.buffer, {
      cachePolicy: 'no-store',
    });
    expect(pdfBuffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(pdfBuffer.length).toBeGreaterThan(50000);
  }, 60000);
});

// ─── Suite 2: Cross-Record Relationship Integrity (Section 1) ───────────────

describe('Phase G Section 1 — Cross-Record Relationship Integrity & Negative Validation', () => {
  const juneDays = buildCompleteCalendarDaysForMonth(MONTH_JUNE_2025, ['2025-06-12']);
  const firstInstructionalDay = juneDays.find((d) => d.isInstructional)!; // 2025-06-02

  it('accepts a valid OfficialDailyAttendance record matching Enrollment, Section, AcademicYear, and CalendarDay', () => {
    const validAttendance: OfficialDailyAttendanceRecord = {
      id: 'att-1',
      academicYearId: AY_2025_2026.id,
      sectionId: SECTION_RIZAL.id,
      enrollmentId: ENROLLMENT_STUDENT_A.id,
      studentId: ENROLLMENT_STUDENT_A.studentId,
      calendarDayId: firstInstructionalDay.id,
      date: firstInstructionalDay.date,
      status: 'P',
      recordStatus: 'VERIFIED',
      recordedById: 'teacher-adviser-1',
    };

    const res = validateOfficialDailyAttendanceRelationship({
      attendance: validAttendance,
      enrollment: ENROLLMENT_STUDENT_A,
      section: SECTION_RIZAL,
      calendarDay: firstInstructionalDay,
      currentManilaDate: '2025-06-30',
    });

    expect(res.valid).toBe(true);
  });

  it('rejects student_id from Student A paired with enrollment_id from Student B', () => {
    const contradictoryAttendance: OfficialDailyAttendanceRecord = {
      id: 'att-bad-stu',
      academicYearId: AY_2025_2026.id,
      sectionId: SECTION_RIZAL.id,
      enrollmentId: ENROLLMENT_STUDENT_A.id,
      studentId: 'stu-b-different-student',
      calendarDayId: firstInstructionalDay.id,
      date: firstInstructionalDay.date,
      status: 'P',
      recordStatus: 'VERIFIED',
      recordedById: 'teacher-adviser-1',
    };

    const res = validateOfficialDailyAttendanceRelationship({
      attendance: contradictoryAttendance,
      enrollment: ENROLLMENT_STUDENT_A,
      section: SECTION_RIZAL,
      calendarDay: firstInstructionalDay,
      currentManilaDate: '2025-06-30',
    });

    expect(res.valid).toBe(false);
    expect(res.code).toBe('CONTRADICTORY_ENROLLMENT_STUDENT');
  });

  it('rejects section_id different from the enrollment section', () => {
    const contradictorySectionAttendance: OfficialDailyAttendanceRecord = {
      id: 'att-bad-sec',
      academicYearId: AY_2025_2026.id,
      sectionId: 'sec-other-bonifacio',
      enrollmentId: ENROLLMENT_STUDENT_A.id,
      studentId: ENROLLMENT_STUDENT_A.studentId,
      calendarDayId: firstInstructionalDay.id,
      date: firstInstructionalDay.date,
      status: 'P',
      recordStatus: 'VERIFIED',
      recordedById: 'teacher-adviser-1',
    };

    const res = validateOfficialDailyAttendanceRelationship({
      attendance: contradictorySectionAttendance,
      enrollment: ENROLLMENT_STUDENT_A,
      section: SECTION_RIZAL,
      calendarDay: firstInstructionalDay,
      currentManilaDate: '2025-06-30',
    });

    expect(res.valid).toBe(false);
    expect(res.code).toBe('CONTRADICTORY_ENROLLMENT_SECTION');
  });

  it('rejects calendar_day_id from another academic year or with a mismatched date', () => {
    const mismatchedDateAttendance: OfficialDailyAttendanceRecord = {
      id: 'att-bad-date',
      academicYearId: AY_2025_2026.id,
      sectionId: SECTION_RIZAL.id,
      enrollmentId: ENROLLMENT_STUDENT_A.id,
      studentId: ENROLLMENT_STUDENT_A.studentId,
      calendarDayId: firstInstructionalDay.id, // 2025-06-02
      date: '2025-06-03',                      // Contradictory date!
      status: 'P',
      recordStatus: 'VERIFIED',
      recordedById: 'teacher-adviser-1',
    };

    const resDate = validateOfficialDailyAttendanceRelationship({
      attendance: mismatchedDateAttendance,
      enrollment: ENROLLMENT_STUDENT_A,
      section: SECTION_RIZAL,
      calendarDay: firstInstructionalDay,
      currentManilaDate: '2025-06-30',
    });
    expect(resDate.valid).toBe(false);
    expect(resDate.code).toBe('CONTRADICTORY_CALENDAR_DAY_DATE');

    const otherYearDay: SchoolCalendarDayRecord = {
      ...firstInstructionalDay,
      academicYearId: 'ay-2024-2025-old',
    };
    const resYear = validateOfficialDailyAttendanceRelationship({
      attendance: {
        ...mismatchedDateAttendance,
        date: firstInstructionalDay.date,
      },
      enrollment: ENROLLMENT_STUDENT_A,
      section: SECTION_RIZAL,
      calendarDay: otherYearDay,
      currentManilaDate: '2025-06-30',
    });
    expect(resYear.valid).toBe(false);
    expect(resYear.code).toBe('CROSS_ACADEMIC_YEAR_MISMATCH');
  });

  it('rejects SectionCalendarException belonging to another academic year or section', () => {
    const badException: SectionCalendarExceptionRecord = {
      id: 'exc-bad',
      academicYearId: 'ay-2024-2025-other',
      sectionId: SECTION_RIZAL.id,
      calendarDayId: firstInstructionalDay.id,
      overrideDayKind: 'CLASS_SUSPENSION',
      overrideIsInstructional: false,
      reason: 'Local suspension',
    };

    const res = validateSectionCalendarExceptionRelationship(
      badException,
      SECTION_RIZAL,
      firstInstructionalDay
    );
    expect(res.valid).toBe(false);
    expect(res.code).toBe('CONTRADICTORY_SECTION_ACADEMIC_YEAR');
  });

  it('rejects DRAFT or VERIFIED attendance recorded on a non-instructional holiday/weekend or future Manila date', () => {
    const holidayDay = juneDays.find((d) => d.date === '2025-06-12')!;
    const holidayAtt: OfficialDailyAttendanceRecord = {
      id: 'att-holiday',
      academicYearId: AY_2025_2026.id,
      sectionId: SECTION_RIZAL.id,
      enrollmentId: ENROLLMENT_STUDENT_A.id,
      studentId: ENROLLMENT_STUDENT_A.studentId,
      calendarDayId: holidayDay.id,
      date: holidayDay.date,
      status: 'P',
      recordStatus: 'DRAFT',
      recordedById: 'teacher-adviser-1',
    };

    const resHoliday = validateOfficialDailyAttendanceRelationship({
      attendance: holidayAtt,
      enrollment: ENROLLMENT_STUDENT_A,
      section: SECTION_RIZAL,
      calendarDay: holidayDay,
      currentManilaDate: '2025-06-30',
    });
    expect(resHoliday.valid).toBe(false);
    expect(resHoliday.code).toBe('NON_INSTRUCTIONAL_DATE_ATTENDANCE_FORBIDDEN');

    const resFuture = validateOfficialDailyAttendanceRelationship({
      attendance: {
        ...holidayAtt,
        recordStatus: 'VERIFIED',
        calendarDayId: firstInstructionalDay.id,
        date: firstInstructionalDay.date, // 2025-06-02
      },
      enrollment: ENROLLMENT_STUDENT_A,
      section: SECTION_RIZAL,
      calendarDay: firstInstructionalDay,
      currentManilaDate: '2025-06-01', // Today is June 1 -> June 2 is future
    });
    expect(resFuture.valid).toBe(false);
    expect(resFuture.code).toBe('FUTURE_DATE_ATTENDANCE_FORBIDDEN');
  });
});

// ─── Suite 3: OfficialAttendanceRecordStatus & Month Finalization Rules ─────

describe('Phase G.1 Section 2 — OfficialAttendanceRecordStatus (DRAFT / VERIFIED / INVALIDATED_NON_INSTRUCTIONAL)', () => {
  const juneDays = buildCompleteCalendarDaysForMonth(MONTH_JUNE_2025, ['2025-06-12']);
  // June 2025 has 30 days: 9 weekend days, 1 holiday (Jun 12) -> 20 instructional days

  it('requires complete calendar date classification before a month can be FINALIZED', () => {
    const incompleteDays = juneDays.slice(0, 29); // Missing 2025-06-30
    const check = evaluateCalendarMonthCompleteness({
      month: MONTH_JUNE_2025,
      academicYear: AY_2025_2026,
      calendarDays: incompleteDays,
    });

    expect(check.canFinalize).toBe(false);
    expect(check.missingDates).toEqual(['2025-06-30']);

    const completeCheck = evaluateCalendarMonthCompleteness({
      month: MONTH_JUNE_2025,
      academicYear: AY_2025_2026,
      calendarDays: juneDays,
    });
    expect(completeCheck.canFinalize).toBe(true);
    expect(completeCheck.instructionalDates.length).toBe(20);
  });

  it('counts VERIFIED rows: P as Present, A as Absent, and L as Present + Tardy (DepEd SF2 rule)', () => {
    const instructionalDays = juneDays.filter((d) => d.isInstructional);
    expect(instructionalDays.length).toBe(20);

    // 16 P, 2 L (Tardy), 2 A -> daysPresent = 18, daysAbsent = 2, daysTardy = 2, classDays = 20
    const records: OfficialDailyAttendanceRecord[] = instructionalDays.map((day, idx) => ({
      id: `att-jun-${idx}`,
      academicYearId: AY_2025_2026.id,
      sectionId: SECTION_RIZAL.id,
      enrollmentId: ENROLLMENT_STUDENT_A.id,
      studentId: ENROLLMENT_STUDENT_A.studentId,
      calendarDayId: day.id,
      date: day.date,
      status: idx < 16 ? 'P' : idx < 18 ? 'L' : 'A',
      recordStatus: 'VERIFIED',
      tardyMinutes: idx >= 16 && idx < 18 ? 15 : null,
      recordedById: 'teacher-adviser-1',
      verifiedById: 'teacher-adviser-1',
    }));

    const summary = aggregateStudentMonthlyAttendanceForSf9({
      month: MONTH_JUNE_2025,
      academicYear: AY_2025_2026,
      section: SECTION_RIZAL,
      enrollment: ENROLLMENT_STUDENT_A,
      calendarDays: juneDays,
      sectionExceptions: [],
      attendanceRecords: records,
      excusedPolicy: 'UNRESOLVED',
      currentManilaDate: '2025-06-30',
    });

    expect(summary.verificationState).toBe('VERIFIED');
    expect(summary.classDays).toBe(20);
    expect(summary.daysPresent).toBe(18);
    expect(summary.daysAbsent).toBe(2);
    expect(summary.daysTardy).toBe(2);
    expect(summary.unverifiedDraftDates).toEqual([]);
    expect(summary.daysPresent + summary.daysAbsent).toBe(summary.classDays);
  });

  it('rejects DRAFT attendance for official SF9 output (returns INCOMPLETE_UNVERIFIED_DRAFT_ATTENDANCE and never counts DRAFT as verified)', () => {
    const instructionalDays = juneDays.filter((d) => d.isInstructional);
    // 19 VERIFIED rows + 1 DRAFT row on the final instructional day (2025-06-30)
    const recordsWithOneDraft: OfficialDailyAttendanceRecord[] = instructionalDays.map((day, idx) => ({
      id: `att-draft-${idx}`,
      academicYearId: AY_2025_2026.id,
      sectionId: SECTION_RIZAL.id,
      enrollmentId: ENROLLMENT_STUDENT_A.id,
      studentId: ENROLLMENT_STUDENT_A.studentId,
      calendarDayId: day.id,
      date: day.date,
      status: 'P',
      recordStatus: idx === 19 ? 'DRAFT' : 'VERIFIED',
      recordedById: 'teacher-adviser-1',
    }));

    const summary = aggregateStudentMonthlyAttendanceForSf9({
      month: MONTH_JUNE_2025,
      academicYear: AY_2025_2026,
      section: SECTION_RIZAL,
      enrollment: ENROLLMENT_STUDENT_A,
      calendarDays: juneDays,
      sectionExceptions: [],
      attendanceRecords: recordsWithOneDraft,
      currentManilaDate: '2025-06-30',
    });

    expect(summary.verificationState).toBe('INCOMPLETE_UNVERIFIED_DRAFT_ATTENDANCE');
    expect(summary.unverifiedDraftDates).toEqual(['2025-06-30']);
    // Only the 19 VERIFIED rows were counted; the 1 DRAFT row was NOT counted as Present
    expect(summary.daysPresent).toBe(19);
    expect(summary.classDays).toBe(20);

    // Confirm mapVerifiedSf2SummariesToCalulutSf9Cells refuses official SF9 generation
    const mapped = mapVerifiedSf2SummariesToCalulutSf9Cells([summary]);
    expect(mapped.readyForOfficialSf9).toBe(false);
    if (!mapped.readyForOfficialSf9) {
      expect(
        mapped.unverifiedMonths.some(
          (m) =>
            m.verificationState === 'INCOMPLETE_UNVERIFIED_DRAFT_ATTENDANCE' &&
            m.unverifiedDraftDates.includes('2025-06-30')
        )
      ).toBe(true);
    }
  });

  it('does NOT silently convert E (Excused) to Present; returns BLOCKED_PENDING_EXCUSED_POLICY when policy is UNRESOLVED', () => {
    const instructionalDays = juneDays.filter((d) => d.isInstructional);
    const records: OfficialDailyAttendanceRecord[] = instructionalDays.map((day, idx) => ({
      id: `att-exc-${idx}`,
      academicYearId: AY_2025_2026.id,
      sectionId: SECTION_RIZAL.id,
      enrollmentId: ENROLLMENT_STUDENT_A.id,
      studentId: ENROLLMENT_STUDENT_A.studentId,
      calendarDayId: day.id,
      date: day.date,
      status: idx === 0 ? 'E' : 'P',
      recordStatus: 'VERIFIED',
      remarks: idx === 0 ? 'School-sanctioned medical excuse' : null,
      recordedById: 'teacher-adviser-1',
    }));

    const unresolvedSummary = aggregateStudentMonthlyAttendanceForSf9({
      month: MONTH_JUNE_2025,
      academicYear: AY_2025_2026,
      section: SECTION_RIZAL,
      enrollment: ENROLLMENT_STUDENT_A,
      calendarDays: juneDays,
      sectionExceptions: [],
      attendanceRecords: records,
      excusedPolicy: 'UNRESOLVED',
      currentManilaDate: '2025-06-30',
    });

    expect(unresolvedSummary.verificationState).toBe('BLOCKED_PENDING_EXCUSED_POLICY');
    expect(unresolvedSummary.daysExcused).toBe(1);
    expect(unresolvedSummary.excusedDates).toEqual([instructionalDays[0].date]);
  });

  it('applies SectionCalendarException exactly once and invalidates DRAFT/VERIFIED attendance upon suspension reopening', () => {
    const targetSuspendDay = juneDays.find((d) => d.date === '2025-06-03')!;
    const sectionSuspension: SectionCalendarExceptionRecord = {
      id: 'exc-jun-03',
      academicYearId: AY_2025_2026.id,
      sectionId: SECTION_RIZAL.id,
      calendarDayId: targetSuspendDay.id,
      overrideDayKind: 'CLASS_SUSPENSION',
      overrideIsInstructional: false,
      reason: 'Localized classroom flooding suspension',
    };

    const impact = planCalendarDayReclassificationImpact({
      monthStatus: 'FINALIZED',
      previousEffectiveInstructional: true,
      nextEffectiveInstructional: false,
      reclassificationReason: sectionSuspension.reason,
      existingAttendanceOnDate: [
        {
          id: 'att-on-jun-03',
          academicYearId: AY_2025_2026.id,
          sectionId: SECTION_RIZAL.id,
          enrollmentId: ENROLLMENT_STUDENT_A.id,
          studentId: ENROLLMENT_STUDENT_A.studentId,
          calendarDayId: targetSuspendDay.id,
          date: targetSuspendDay.date,
          status: 'P',
          recordStatus: 'VERIFIED',
          recordedById: 'teacher-adviser-1',
        },
      ],
    });

    expect(impact.requiresMonthReopen).toBe(true);
    expect(impact.transitionType).toBe('INSTRUCTIONAL_TO_SUSPENDED');
    expect(impact.attendanceIdsToInvalidate).toEqual(['att-on-jun-03']);

    // Now aggregate with June 3 marked INVALIDATED_NON_INSTRUCTIONAL -> 19 classDays
    const remainingInstructional = juneDays.filter(
      (d) => d.isInstructional && d.date !== '2025-06-03'
    );
    const records: OfficialDailyAttendanceRecord[] = [
      {
        id: 'att-on-jun-03',
        academicYearId: AY_2025_2026.id,
        sectionId: SECTION_RIZAL.id,
        enrollmentId: ENROLLMENT_STUDENT_A.id,
        studentId: ENROLLMENT_STUDENT_A.studentId,
        calendarDayId: targetSuspendDay.id,
        date: targetSuspendDay.date,
        status: 'P',
        recordStatus: 'INVALIDATED_NON_INSTRUCTIONAL',
        invalidationReason: sectionSuspension.reason,
        recordedById: 'teacher-adviser-1',
      },
      ...remainingInstructional.map((day, idx) => ({
        id: `att-rem-${idx}`,
        academicYearId: AY_2025_2026.id,
        sectionId: SECTION_RIZAL.id,
        enrollmentId: ENROLLMENT_STUDENT_A.id,
        studentId: ENROLLMENT_STUDENT_A.studentId,
        calendarDayId: day.id,
        date: day.date,
        status: 'P' as const,
        recordStatus: 'VERIFIED' as const,
        recordedById: 'teacher-adviser-1',
      })),
    ];

    const summary = aggregateStudentMonthlyAttendanceForSf9({
      month: MONTH_JUNE_2025,
      academicYear: AY_2025_2026,
      section: SECTION_RIZAL,
      enrollment: ENROLLMENT_STUDENT_A,
      calendarDays: juneDays,
      sectionExceptions: [sectionSuspension],
      attendanceRecords: records,
      currentManilaDate: '2025-06-30',
    });

    expect(summary.verificationState).toBe('VERIFIED');
    expect(summary.classDays).toBe(19);
    expect(summary.daysPresent).toBe(19);
    expect(summary.daysAbsent).toBe(0);
  });

  it('blocks official SF9 generation when any instructional day has missing attendance', () => {
    const instructionalDays = juneDays.filter((d) => d.isInstructional);
    // Leave out the last instructional day (2025-06-30)
    const partialRecords: OfficialDailyAttendanceRecord[] = instructionalDays
      .slice(0, 19)
      .map((day, idx) => ({
        id: `att-part-${idx}`,
        academicYearId: AY_2025_2026.id,
        sectionId: SECTION_RIZAL.id,
        enrollmentId: ENROLLMENT_STUDENT_A.id,
        studentId: ENROLLMENT_STUDENT_A.studentId,
        calendarDayId: day.id,
        date: day.date,
        status: 'P',
        recordStatus: 'VERIFIED',
        recordedById: 'teacher-adviser-1',
      }));

    const summary = aggregateStudentMonthlyAttendanceForSf9({
      month: MONTH_JUNE_2025,
      academicYear: AY_2025_2026,
      section: SECTION_RIZAL,
      enrollment: ENROLLMENT_STUDENT_A,
      calendarDays: juneDays,
      sectionExceptions: [],
      attendanceRecords: partialRecords,
      currentManilaDate: '2025-06-30',
    });

    expect(summary.verificationState).toBe('INCOMPLETE_MISSING_ATTENDANCE');
    expect(summary.missingInstructionalDates).toEqual(['2025-06-30']);
  });
});

// ─── Suite 4: Protected Published Grades & Optimistic Concurrency Helpers ───

describe('Phase G.1 Section 3 — Prepared Grade Publication & Optimistic Concurrency Helpers', () => {
  it('enforces integer published_term_grade (60..100) and rejects floating-point drift', () => {
    const floatAttempt = validateGradePublicationSnapshot({
      enrollmentId: ENROLLMENT_STUDENT_A.id,
      subjectId: 'subj-math-7',
      term: 1,
      gradebookId: 'gb-math-t1',
      currentGradebookStatus: 'Verified',
      currentGradebookVersion: 3,
      expectedGradebookVersion: 3,
      transmutedTermGrade: 89.5, // Floating-point not allowed!
      initialGrade: 83.25,
      publishedById: 'user-registrar-1',
      isRepublicationCorrection: false,
    });

    expect(floatAttempt.valid).toBe(false);
    expect(floatAttempt.code).toBe('INVALID_PUBLISHED_TERM_GRADE_INTEGER');

    const validAttempt = validateGradePublicationSnapshot({
      enrollmentId: ENROLLMENT_STUDENT_A.id,
      subjectId: 'subj-math-7',
      term: 1,
      gradebookId: 'gb-math-t1',
      currentGradebookStatus: 'Verified',
      currentGradebookVersion: 3,
      expectedGradebookVersion: 3,
      transmutedTermGrade: 90,
      initialGrade: 84.4,
      publishedById: 'user-registrar-1',
      isRepublicationCorrection: false,
    });

    expect(validAttempt.valid).toBe(true);
    expect(validAttempt.normalizedPublishedSnapshot?.publishedTermGrade).toBe(90);
    expect(validAttempt.normalizedPublishedSnapshot?.publishedInitialGradeFixed2).toBe('84.40');
    expect(validAttempt.normalizedPublishedSnapshot?.publishedVersion).toBe(4);
  });

  it('rejects concurrent gradebook publication and blocks draft saveLedger from overwriting Published gradebooks', () => {
    const stalePublish = validateGradePublicationSnapshot({
      enrollmentId: ENROLLMENT_STUDENT_A.id,
      subjectId: 'subj-math-7',
      term: 1,
      gradebookId: 'gb-math-t1',
      currentGradebookStatus: 'Verified',
      currentGradebookVersion: 5,
      expectedGradebookVersion: 4, // Stale version
      transmutedTermGrade: 88,
      initialGrade: 81.0,
      publishedById: 'user-registrar-1',
      isRepublicationCorrection: false,
    });
    expect(stalePublish.valid).toBe(false);
    expect(stalePublish.code).toBe('OPTIMISTIC_LOCK_VERSION_CONFLICT');

    const draftOverwriteOnPublished = assertGradebookWritableForDraftSave({
      gradebookId: 'gb-math-t1',
      status: 'Published',
      currentVersion: 5,
      expectedVersion: 5,
    });
    expect(draftOverwriteOnPublished.writable).toBe(false);
    expect(draftOverwriteOnPublished.code).toBe('GRADEBOOK_LOCKED_PUBLISHED');
  });

  it('requires a documented correctionReason when republishing a corrected grade', () => {
    const missingReason = validateGradePublicationSnapshot({
      enrollmentId: ENROLLMENT_STUDENT_A.id,
      subjectId: 'subj-math-7',
      term: 1,
      gradebookId: 'gb-math-t1',
      currentGradebookStatus: 'Published',
      currentGradebookVersion: 5,
      expectedGradebookVersion: 5,
      transmutedTermGrade: 91,
      initialGrade: 86.0,
      publishedById: 'user-registrar-1',
      isRepublicationCorrection: true,
      correctionReason: '   ',
    });
    expect(missingReason.valid).toBe(false);
    expect(missingReason.code).toBe('MISSING_CORRECTION_REASON_FOR_REPUBLICATION');
  });
});

// ─── Suite 5: Adviser Authorization, Comments, Issuance & Schema Alignment ──

describe('Phase G.1 Section 4 & 5 — Adviser Authorization, Comments, Issuance & Migration Alignment', () => {
  it('permits only the assigned Class Adviser or Admin/Registrar with overrideReason', () => {
    const adviserAuth = authorizeSectionAdviserOrOverride({
      actor: { userId: 'teacher-adviser-1', role: 'Teacher' },
      section: SECTION_RIZAL,
    });
    expect(adviserAuth.authorized).toBe(true);
    expect(adviserAuth.isOverride).toBe(false);

    const otherTeacherAuth = authorizeSectionAdviserOrOverride({
      actor: { userId: 'teacher-subject-only', role: 'Teacher' },
      section: SECTION_RIZAL,
    });
    expect(otherTeacherAuth.authorized).toBe(false);

    const registrarNoReason = authorizeSectionAdviserOrOverride({
      actor: { userId: 'registrar-1', role: 'Registrar' },
      section: SECTION_RIZAL,
      overrideReason: '',
    });
    expect(registrarNoReason.authorized).toBe(false);

    const registrarWithReason = authorizeSectionAdviserOrOverride({
      actor: { userId: 'registrar-1', role: 'Registrar' },
      section: SECTION_RIZAL,
      overrideReason: 'Adviser on approved medical leave',
    });
    expect(registrarWithReason.authorized).toBe(true);
    expect(registrarWithReason.isOverride).toBe(true);
  });

  it('maps only PUBLISHED adviser comments to F14/J14/O14 -> R15/R19/R23 for official SF9 and rejects cross-student comments', () => {
    const resolved = resolveSf9AdviserCommentsForCells({
      enrollment: ENROLLMENT_STUDENT_A,
      mode: 'OFFICIAL',
      comments: [
        {
          enrollmentId: ENROLLMENT_STUDENT_A.id,
          studentId: ENROLLMENT_STUDENT_A.studentId,
          sectionId: SECTION_RIZAL.id,
          academicYearId: AY_2025_2026.id,
          term: 1,
          commentText: 'Consistently active in class discussions.',
          status: 'PUBLISHED',
        },
        {
          enrollmentId: ENROLLMENT_STUDENT_A.id,
          studentId: ENROLLMENT_STUDENT_A.studentId,
          sectionId: SECTION_RIZAL.id,
          academicYearId: AY_2025_2026.id,
          term: 2,
          commentText: 'Unpublished draft note - must not leak',
          status: 'DRAFT',
        },
      ],
    });

    expect(resolved.integrityErrors).toEqual([]);
    expect(resolved.entryCellValues.F14).toBe('Consistently active in class discussions.');
    expect(resolved.entryCellValues.J14).toBe('');
    expect(resolved.entryCellValues.O14).toBe('');
    expect(resolved.cellValues.R15).toBe('Consistently active in class discussions.');
    expect(resolved.cellValues.R19).toBe('');
    expect(resolved.cellValues.R23).toBe('');
  });

  it('enforces encryption, SHA-256 checksums, student isolation, and supersession chain on Sf9OfficialIssuance', () => {
    const validSha = 'a'.repeat(64);
    const v1Issuance = {
      id: 'iss-v1',
      enrollmentId: ENROLLMENT_STUDENT_A.id,
      studentId: ENROLLMENT_STUDENT_A.studentId,
      sectionId: SECTION_RIZAL.id,
      academicYearId: AY_2025_2026.id,
      versionNumber: 1,
      status: 'ISSUED' as const,
      isCurrent: true,
      templateSha256: validSha,
      xlsxSha256: validSha,
      pdfSha256: validSha,
      libreofficeVersion: 'LibreOffice 24.8.4.2',
      issuedPdfDocumentId: 'doc-pdf-v1',
      frozenPayloadEncrypted: 'v1.aes256gcm.encrypted_frozen_payload_ciphertext',
      calculatedSummaryEncrypted: 'v1.aes256gcm.encrypted_summary_ciphertext',
      adviserSignatoryName: 'Maria Clara Santos',
      schoolHeadSignatoryName: 'Juan Dela Cruz, EdD',
      issuedById: 'registrar-1',
    };

    expect(
      validateOfficialSf9IssuanceRecord({
        issuance: v1Issuance,
        enrollment: ENROLLMENT_STUDENT_A,
      }).valid
    ).toBe(true);

    // Reject unencrypted raw JSON snapshot
    const unencryptedRes = validateOfficialSf9IssuanceRecord({
      issuance: {
        ...v1Issuance,
        frozenPayloadEncrypted: '{"demographics":{"name":"Plaintext Leak"}}',
      },
      enrollment: ENROLLMENT_STUDENT_A,
    });
    expect(unencryptedRes.valid).toBe(false);
    expect(unencryptedRes.code).toBe('UNENCRYPTED_SENSITIVE_SNAPSHOT');

    // Reject cross-student issuance mismatch
    const crossStudentRes = validateOfficialSf9IssuanceRecord({
      issuance: {
        ...v1Issuance,
        studentId: 'stu-someone-else',
      },
      enrollment: ENROLLMENT_STUDENT_A,
    });
    expect(crossStudentRes.valid).toBe(false);
    expect(crossStudentRes.code).toBe('CROSS_STUDENT_ISOLATION_VIOLATION');

    // Validate v2 supersession chain
    const v2Issuance = {
      ...v1Issuance,
      id: 'iss-v2',
      versionNumber: 2,
      supersedesIssuanceId: 'iss-v1',
      reissueReason: 'Approved grade correction in Mathematics Term 2',
    };
    expect(
      validateOfficialSf9IssuanceRecord({
        issuance: v2Issuance,
        enrollment: ENROLLMENT_STUDENT_A,
        previousCurrentIssuance: v1Issuance,
      }).valid
    ).toBe(true);
  });

  it('verifies alignment between phase_g_sf2_sf9_schema.prisma and phase_g_sf2_sf9_migration.draft.sql', () => {
    const proposalsDir = path.resolve(
      path.dirname(DEFAULT_MASTER_TEMPLATE_PATH),
      '..',
      '..',
      'prisma',
      'proposals'
    );
    const prismaText = fs.readFileSync(
      path.join(proposalsDir, 'phase_g_sf2_sf9_schema.prisma'),
      'utf8'
    );
    const sqlText = fs.readFileSync(
      path.join(proposalsDir, 'phase_g_sf2_sf9_migration.draft.sql'),
      'utf8'
    );

    // Verify OfficialAttendanceRecordStatus enum values match across Prisma, SQL, and TS
    expect(prismaText).toContain('enum OfficialAttendanceRecordStatus');
    expect(prismaText).toContain('DRAFT\n  VERIFIED\n  INVALIDATED_NON_INSTRUCTIONAL');
    expect(sqlText).toContain(
      "CREATE TYPE \"OfficialAttendanceRecordStatus\" AS ENUM (\n  'DRAFT', 'VERIFIED', 'INVALIDATED_NON_INSTRUCTIONAL'\n);"
    );

    // Verify Enrollment.section preserves Prisma Client compatibility while SQL enforces composite FK
    expect(prismaText).toContain(
      'section                   Section                   @relation(fields: [section_id], references: [id], map: "student_enrollments_section_id_fkey")'
    );
    expect(sqlText).toContain('CONSTRAINT "student_enrollments_section_ay_fkey"');

    // Verify composite FKs on OfficialDailyAttendance, Sf9AdviserComment, and Sf9OfficialIssuance
    expect(sqlText).toContain('CONSTRAINT "official_daily_attendance_enrollment_composite_fkey"');
    expect(sqlText).toContain('CONSTRAINT "sf9_adviser_comments_enrollment_composite_fkey"');
    expect(sqlText).toContain('CONSTRAINT "sf9_official_issuances_enrollment_composite_fkey"');

    // Static Prisma CLI validation of phase_g_sf2_sf9_schema.prisma (zero DB connection or migration)
    const backendRoot = path.resolve(proposalsDir, '..', '..');
    const prismaCliJs = path.join(backendRoot, 'node_modules', 'prisma', 'build', 'index.js');
    const schemaPath = path.join(proposalsDir, 'phase_g_sf2_sf9_schema.prisma');
    const validateOutput = execFileSync(
      process.execPath,
      [prismaCliJs, 'validate', '--schema', schemaPath],
      {
        cwd: backendRoot,
        env: {
          ...process.env,
          DATABASE_URL:
            process.env.DATABASE_URL ||
            'postgresql://postgres:postgres@localhost:5432/digiskwela_test?schema=public',
        },
        encoding: 'utf8',
      }
    );
    expect(validateOutput).toContain('is valid');
  });

  it('parses Asia/Manila YYYY-MM-DD dates deterministically without UTC off-by-one drift', () => {
    const parsed = parseManilaDateOnly('2025-06-01');
    expect(parsed).toEqual({
      year: 2025,
      month: 6,
      day: 1,
      isoDate: '2025-06-01',
    });
    expect(parseManilaDateOnly('2025-02-29')).toBeNull(); // 2025 is not a leap year
  });
});
