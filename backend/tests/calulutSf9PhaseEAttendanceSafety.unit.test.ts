import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  isFutureCalendarDate,
  buildMonthlyAttendanceMap,
  getRecordedStatus,
  countStudentStatusInMonth,
  countStudentRecordedDaysInMonth,
  countStudentUnrecordedDaysInMonth,
  computeStudentRecordedAttendanceRate,
  countRosterStatusOnDate,
  computeDayCalendarSummary,
  cycleManualAttendanceStatus,
  buildBulkSaveUpdatesForDate,
  buildBulkSaveUpdatesForMonth,
  buildSubjectAttendanceCsv,
  RawAttendanceRecord,
  RosterEntry,
} from '../../src/app/teacher/attendance/attendanceAccuracyUtils.js';
import { FORM_SF2_QUARANTINE_STATUS } from '../../src/app/teacher/templates/components/FormSF2.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('DIGISKWELA — Phase E: Attendance Accuracy Correction & Mock SF2 Quarantine', () => {
  // Reference date: October 15, 2026 (monthZeroIndexed = 9)
  const referenceNow = new Date(2026, 9, 15, 10, 30, 0);
  const year = 2026;
  const octoberZeroIndexed = 9;
  const octoberDays = Array.from({ length: 31 }, (_, i) => i + 1);

  const roster: RosterEntry[] = [
    {
      id: 'enr-student-1',
      student: { first_name: 'Juan', last_name: 'Dela Cruz', lrn: '100000000001' },
    },
    {
      id: 'enr-student-2',
      student: { first_name: 'Maria', last_name: 'Clara', lrn: '100000000002' },
    },
  ];

  const sampleRecords: RawAttendanceRecord[] = [
    // October 2026 saved statuses for Student 1: Oct 5 (P), Oct 6 (A), Oct 7 (L), Oct 8 (E)
    { enrollment_id: 'enr-student-1', date: '2026-10-05T00:00:00.000Z', status: 'P' },
    { enrollment_id: 'enr-student-1', date: '2026-10-06T00:00:00.000Z', status: 'A' },
    { enrollment_id: 'enr-student-1', date: '2026-10-07T00:00:00.000Z', status: 'L' },
    { enrollment_id: 'enr-student-1', date: '2026-10-08T00:00:00.000Z', status: 'E' },
    // Future date in October (Oct 20, 2026 > referenceNow Oct 15, 2026) — must be ignored
    { enrollment_id: 'enr-student-1', date: '2026-10-20T00:00:00.000Z', status: 'P' },
    // Previous month record (September 12, 2026) — must NOT bleed into October day 12
    { enrollment_id: 'enr-student-1', date: '2026-09-12T00:00:00.000Z', status: 'P' },
  ];

  it('1. Missing subject attendance is Not Recorded (null), never defaulting to Present ("P")', () => {
    const attData = buildMonthlyAttendanceMap(
      sampleRecords,
      year,
      octoberZeroIndexed,
      referenceNow
    );

    // Student 2 has zero saved records in October 2026
    for (const day of octoberDays) {
      expect(
        getRecordedStatus(attData, 'enr-student-2', day, year, octoberZeroIndexed, referenceNow)
      ).toBeNull();
    }

    expect(
      countStudentStatusInMonth(
        attData,
        'enr-student-2',
        'P',
        octoberDays,
        year,
        octoberZeroIndexed,
        referenceNow
      )
    ).toBe(0);
    expect(
      countStudentRecordedDaysInMonth(
        attData,
        'enr-student-2',
        octoberDays,
        year,
        octoberZeroIndexed,
        referenceNow
      )
    ).toBe(0);
    expect(
      countStudentUnrecordedDaysInMonth(
        attData,
        'enr-student-2',
        octoberDays,
        year,
        octoberZeroIndexed,
        referenceNow
      )
    ).toBe(31);
    expect(
      computeStudentRecordedAttendanceRate(
        attData,
        'enr-student-2',
        octoberDays,
        year,
        octoberZeroIndexed,
        referenceNow
      )
    ).toBeNull();

    // Unrecorded weekday (Oct 1) and weekend (Oct 3/4) for Student 1 also remain null
    expect(
      getRecordedStatus(attData, 'enr-student-1', 1, year, octoberZeroIndexed, referenceNow)
    ).toBeNull();
    expect(
      getRecordedStatus(attData, 'enr-student-1', 3, year, octoberZeroIndexed, referenceNow)
    ).toBeNull();
    expect(
      getRecordedStatus(attData, 'enr-student-1', 4, year, octoberZeroIndexed, referenceNow)
    ).toBeNull();
  });

  it('2. Future dates are rejected/ignored and never counted as Present', () => {
    expect(isFutureCalendarDate(2026, octoberZeroIndexed, 15, referenceNow)).toBe(false);
    expect(isFutureCalendarDate(2026, octoberZeroIndexed, 16, referenceNow)).toBe(true);
    expect(isFutureCalendarDate(2026, 10, 1, referenceNow)).toBe(true); // Nov 2026
    expect(isFutureCalendarDate(2027, 0, 1, referenceNow)).toBe(true); // Jan 2027

    const attData = buildMonthlyAttendanceMap(
      sampleRecords,
      year,
      octoberZeroIndexed,
      referenceNow
    );

    // Oct 20 was in sampleRecords, but is after Oct 15 referenceNow -> must be null
    expect(
      getRecordedStatus(attData, 'enr-student-1', 20, year, octoberZeroIndexed, referenceNow)
    ).toBeNull();

    // Even if attData were mutated with a future date, getRecordedStatus blocks future dates
    const mutated = {
      ...attData,
      'enr-student-1': { ...(attData['enr-student-1'] || {}), 25: 'P' as const },
    };
    expect(
      getRecordedStatus(mutated, 'enr-student-1', 25, year, octoberZeroIndexed, referenceNow)
    ).toBeNull();

    // Mini-calendar summary on future date returns presentPct: null and recordedCount: 0
    const futureDaySummary = computeDayCalendarSummary(
      mutated,
      roster,
      25,
      year,
      octoberZeroIndexed,
      referenceNow
    );
    expect(futureDaySummary.isFuture).toBe(true);
    expect(futureDaySummary.recordedCount).toBe(0);
    expect(futureDaySummary.presentCount).toBe(0);
    expect(futureDaySummary.presentPct).toBeNull();

    // Bulk save on a future date produces an empty payload
    expect(
      buildBulkSaveUpdatesForDate(mutated, roster, 25, year, octoberZeroIndexed, referenceNow)
    ).toEqual([]);
  });

  it('3. Unrecorded dates are NOT automatically converted into Absent ("A")', () => {
    const attData = buildMonthlyAttendanceMap(
      sampleRecords,
      year,
      octoberZeroIndexed,
      referenceNow
    );

    // Student 2 has 0 recorded days -> Absent count must be 0, not 31
    expect(
      countStudentStatusInMonth(
        attData,
        'enr-student-2',
        'A',
        octoberDays,
        year,
        octoberZeroIndexed,
        referenceNow
      )
    ).toBe(0);

    // On Oct 9 (unrecorded for both students), roster counts must be P=0, A=0, L=0, E=0, NotRecorded=2
    expect(
      countRosterStatusOnDate(attData, roster, 9, 'P', year, octoberZeroIndexed, referenceNow)
    ).toBe(0);
    expect(
      countRosterStatusOnDate(attData, roster, 9, 'A', year, octoberZeroIndexed, referenceNow)
    ).toBe(0);
    expect(
      countRosterStatusOnDate(attData, roster, 9, 'L', year, octoberZeroIndexed, referenceNow)
    ).toBe(0);
    expect(
      countRosterStatusOnDate(attData, roster, 9, 'E', year, octoberZeroIndexed, referenceNow)
    ).toBe(0);
    expect(
      countRosterStatusOnDate(attData, roster, 9, null, year, octoberZeroIndexed, referenceNow)
    ).toBe(2);
  });

  it('4. Recorded Present, Absent, Late, and Excused statuses are preserved accurately without cross-month bleed', () => {
    const attData = buildMonthlyAttendanceMap(
      sampleRecords,
      year,
      octoberZeroIndexed,
      referenceNow
    );

    expect(
      getRecordedStatus(attData, 'enr-student-1', 5, year, octoberZeroIndexed, referenceNow)
    ).toBe('P');
    expect(
      getRecordedStatus(attData, 'enr-student-1', 6, year, octoberZeroIndexed, referenceNow)
    ).toBe('A');
    expect(
      getRecordedStatus(attData, 'enr-student-1', 7, year, octoberZeroIndexed, referenceNow)
    ).toBe('L');
    expect(
      getRecordedStatus(attData, 'enr-student-1', 8, year, octoberZeroIndexed, referenceNow)
    ).toBe('E');

    // September 12 record must NOT appear on October 12
    expect(
      getRecordedStatus(attData, 'enr-student-1', 12, year, octoberZeroIndexed, referenceNow)
    ).toBeNull();

    // Student 1 counts in October: P=1, A=1, L=1, E=1, Recorded=4, Unrecorded=27
    expect(
      countStudentStatusInMonth(
        attData,
        'enr-student-1',
        'P',
        octoberDays,
        year,
        octoberZeroIndexed,
        referenceNow
      )
    ).toBe(1);
    expect(
      countStudentStatusInMonth(
        attData,
        'enr-student-1',
        'A',
        octoberDays,
        year,
        octoberZeroIndexed,
        referenceNow
      )
    ).toBe(1);
    expect(
      countStudentStatusInMonth(
        attData,
        'enr-student-1',
        'L',
        octoberDays,
        year,
        octoberZeroIndexed,
        referenceNow
      )
    ).toBe(1);
    expect(
      countStudentStatusInMonth(
        attData,
        'enr-student-1',
        'E',
        octoberDays,
        year,
        octoberZeroIndexed,
        referenceNow
      )
    ).toBe(1);
    expect(
      countStudentRecordedDaysInMonth(
        attData,
        'enr-student-1',
        octoberDays,
        year,
        octoberZeroIndexed,
        referenceNow
      )
    ).toBe(4);
    expect(
      countStudentUnrecordedDaysInMonth(
        attData,
        'enr-student-1',
        octoberDays,
        year,
        octoberZeroIndexed,
        referenceNow
      )
    ).toBe(27);

    // Rate is computed over the 4 recorded days: 1 Present / 4 Recorded = 25%
    expect(
      computeStudentRecordedAttendanceRate(
        attData,
        'enr-student-1',
        octoberDays,
        year,
        octoberZeroIndexed,
        referenceNow
      )
    ).toBe(25);

    // Manual cycle starts from null -> P -> A -> L -> E -> P
    expect(cycleManualAttendanceStatus(null)).toBe('P');
    expect(cycleManualAttendanceStatus('P')).toBe('A');
    expect(cycleManualAttendanceStatus('A')).toBe('L');
    expect(cycleManualAttendanceStatus('L')).toBe('E');
    expect(cycleManualAttendanceStatus('E')).toBe('P');

    // Bulk save for month only emits the 4 actually recorded entries
    const monthUpdates = buildBulkSaveUpdatesForMonth(
      attData,
      roster,
      octoberDays,
      year,
      octoberZeroIndexed,
      referenceNow
    );
    expect(monthUpdates).toHaveLength(4);
    expect(monthUpdates.map((u) => `${u.date}:${u.status}`)).toEqual([
      '2026-10-05:P',
      '2026-10-06:A',
      '2026-10-07:L',
      '2026-10-08:E',
    ]);
  });

  it('5. Subject Class Attendance CSV export reflects only actual saved data and counts Not Recorded days', () => {
    const attData = buildMonthlyAttendanceMap(
      sampleRecords,
      year,
      octoberZeroIndexed,
      referenceNow
    );

    const csv = buildSubjectAttendanceCsv(
      attData,
      roster,
      31,
      year,
      octoberZeroIndexed,
      referenceNow
    );
    const lines = csv.trim().split('\n');

    expect(lines).toHaveLength(3); // Header + 2 students
    expect(lines[0]).toContain(
      "Learner's Name,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,Recorded Present,Recorded Absent,Recorded Late,Recorded Excused,Not Recorded Days"
    );

    // Student 1: P=1 (day 5), A=1 (day 6), L=1 (day 7), E=1 (day 8), Not Recorded=27
    expect(lines[1]).toContain('"Dela Cruz, Juan"');
    expect(lines[1].endsWith(',1,1,1,1,27')).toBe(true);
    expect(lines[1]).toContain(',,,,P,A,L,E,');

    // Student 2: P=0, A=0, L=0, E=0, Not Recorded=31
    expect(lines[2]).toContain('"Clara, Maria"');
    expect(lines[2].endsWith(',0,0,0,0,31')).toBe(true);
  });

  it('6. Quarantines FormSF2.tsx and verifies no fabricated SF2 or default "P" exists in source components', () => {
    expect(FORM_SF2_QUARANTINE_STATUS.isOfficialSf2Available).toBe(false);
    expect(FORM_SF2_QUARANTINE_STATUS.status).toBe('QUARANTINED_PENDING_AUTHORITATIVE_MODELS');
    expect(FORM_SF2_QUARANTINE_STATUS.allowFabricatedAttendance).toBe(false);
    expect(FORM_SF2_QUARANTINE_STATUS.allowSeedRosterFallback).toBe(false);

    const formSf2Path = path.resolve(
      __dirname,
      '../../src/app/teacher/templates/components/FormSF2.tsx'
    );
    const formSf2Source = fs.readFileSync(formSf2Path, 'utf-8');

    // Must not import SECTION_GRADES or fabricate hash attendance or hardcode fake signatories/School ID
    expect(formSf2Source).not.toContain('SECTION_GRADES');
    expect(formSf2Source).not.toContain('studentId * 13');
    expect(formSf2Source).not.toContain('300762');
    expect(formSf2Source).not.toContain('Ana R. Soriano');
    expect(formSf2Source).not.toContain('Dr. Maria Santos');
    expect(formSf2Source).toContain('Official DepEd SF2 Issuance Blocked');

    const attendanceHubPath = path.resolve(
      __dirname,
      '../../src/app/teacher/attendance/AttendanceHub.tsx'
    );
    const attendanceHubSource = fs.readFileSync(attendanceHubPath, 'utf-8');

    // Must not default missing attendance to "P" or claim official DepEd SF2 readiness
    expect(attendanceHubSource).not.toContain('?? "P"');
    expect(attendanceHubSource).not.toContain("?? 'P'");
    expect(attendanceHubSource).not.toContain('DepEd SF2 Generation Ready');
    expect(attendanceHubSource).toContain('Subject Class Attendance Export');
    expect(attendanceHubSource).toContain('Not Recorded');
  });
});

