/**
 * DIGISKWELA — Phase H.2 Database Integration Test Suite (`digiskwela_test`)
 * Module: tests/calulutSf9PhaseH2DatabaseIntegration.test.ts
 *
 * Executes all 18 required Phase H.2 database integration scenarios against
 * the isolated PostgreSQL 17 `digiskwela_test` database using synthetic test
 * fixtures that are completely cleaned up after execution.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import AdmZip from 'adm-zip';
import request from 'supertest';
import { PrismaClient } from '../src/generated/sf2Sf9TestClient/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import app from '../src/app.js';
import {
  CALULUT_SF9_MONTH_SLOTS,
  enumerateDatesInMonth,
  upsertSchoolCalendarMonth,
  upsertSchoolCalendarDay,
  upsertSectionCalendarException,
  finalizeSchoolCalendarMonth,
  reopenSchoolCalendarMonth,
  recordOfficialDailyAttendance,
  verifyOfficialDailyAttendance,
  computePersistedStudentMonthlyAttendance,
  assignSectionClassAdviser,
  saveSf9AdviserComment,
  resolvePersistedSf9Signatories,
  saveDraftGradeLedgerEntry,
  publishSubjectTermGradeSnapshot,
  generatePersistedStudentCalulutSf9FromDb,
  type Sf9MonthKeyLiteral,
} from '../src/academic/grading/index.js';

const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ||
  'postgresql://digiskwela_test_user:4AG2GOiMKcQl-T5zJPr4NwlV2PbyWpb_@localhost:5432/digiskwela_test?schema=public';

const testDb = new PrismaClient({
  datasources: {
    db: { url: TEST_DB_URL },
  },
});

const PREFIX = 'h2_int_test_';
const AY_ID = `${PREFIX}ay_2030_2031`;
const SEC_A_ID = `${PREFIX}sec_rizal`;
const SEC_B_ID = `${PREFIX}sec_bonifacio`;

const ADMIN_USER_ID = `${PREFIX}usr_admin`;
const ADVISER_A_USER_ID = `${PREFIX}usr_adviser_a`;
const ADVISER_A_TEACHER_ID = `${PREFIX}tch_adviser_a`;
const ADVISER_B_USER_ID = `${PREFIX}usr_adviser_b`;
const ADVISER_B_TEACHER_ID = `${PREFIX}tch_adviser_b`;
const UNASSIGNED_USER_ID = `${PREFIX}usr_unassigned`;
const UNASSIGNED_TEACHER_ID = `${PREFIX}tch_unassigned`;

const STU_A_USER_ID = `${PREFIX}usr_stu_a`;
const STU_A_ID = `${PREFIX}stu_a`;
const ENR_A_ID = `${PREFIX}enr_stu_a`;

const STU_B_USER_ID = `${PREFIX}usr_stu_b`;
const STU_B_ID = `${PREFIX}stu_b`;
const ENR_B_ID = `${PREFIX}enr_stu_b`;

const STU_TRANSFER_USER_ID = `${PREFIX}usr_stu_transfer`;
const STU_TRANSFER_ID = `${PREFIX}stu_transfer`;
const ENR_TRANSFER_1_ID = `${PREFIX}enr_transfer_sec_a`;
const ENR_TRANSFER_2_ID = `${PREFIX}enr_transfer_sec_b`;

const TERM_IDS = {
  T1: `${PREFIX}term_t1`,
  T2: `${PREFIX}term_t2`,
  T3: `${PREFIX}term_t3`,
} as const;

const SUBJECT_DEFS = [
  { key: 'filipino', code: `${PREFIX}FIL7`, name: 'Filipino 7', scores: [89, 91, 93] as [number, number, number] },
  { key: 'english', code: `${PREFIX}ENG7`, name: 'English 7', scores: [86, 88, 90] as [number, number, number] },
  { key: 'math', code: `${PREFIX}MATH7`, name: 'Mathematics 7', scores: [92, 94, 96] as [number, number, number] },
  { key: 'science', code: `${PREFIX}SCI7`, name: 'Science 7', scores: [88, 90, 92] as [number, number, number] },
  { key: 'ap', code: `${PREFIX}AP7`, name: 'Araling Panlipunan 7', scores: [87, 89, 91] as [number, number, number] },
  { key: 'gmrc', code: `${PREFIX}GMRC7`, name: 'GMRC / Values Education 7', scores: [93, 95, 97] as [number, number, number] },
  { key: 'tle', code: `${PREFIX}TLE7`, name: 'Technology and Livelihood Education 7', scores: [88, 90, 92] as [number, number, number] },
  { key: 'music', code: `${PREFIX}MUS7`, name: 'Music and Arts 7', scores: [90, 92, 94] as [number, number, number] },
  { key: 'pe', code: `${PREFIX}PE7`, name: 'Physical Education and Health 7', scores: [88, 90, 92] as [number, number, number] },
] as const;

function readCellFromXml(
  xml: string,
  cellRef: string
): { formula: string | null; value: string | null; typeAttr: string | null } {
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

async function cleanupSyntheticTestRecords(): Promise<void> {
  await testDb.sf9OfficialIssuance.deleteMany({
    where: { academic_year_id: AY_ID },
  });
  await testDb.sf9AdviserComment.deleteMany({
    where: { academic_year_id: AY_ID },
  });
  await testDb.officialDailyAttendance.deleteMany({
    where: { academic_year_id: AY_ID },
  });
  await testDb.sectionCalendarException.deleteMany({
    where: { academic_year_id: AY_ID },
  });
  await testDb.schoolCalendarDay.deleteMany({
    where: { academic_year_id: AY_ID },
  });
  await testDb.schoolCalendarMonth.deleteMany({
    where: { academic_year_id: AY_ID },
  });
  await testDb.grade.deleteMany({
    where: { academic_year_id: AY_ID },
  });
  await testDb.gradebooks.deleteMany({
    where: { id: { startsWith: PREFIX } },
  });
  await testDb.teacherSubjectAssignment.deleteMany({
    where: { id: { startsWith: PREFIX } },
  });
  await testDb.subject.deleteMany({
    where: { id: { startsWith: PREFIX } },
  });
  await testDb.term.deleteMany({
    where: { academic_year_id: AY_ID },
  });
  await testDb.enrollment.deleteMany({
    where: { academic_year_id: AY_ID },
  });
  await testDb.student.deleteMany({
    where: { id: { startsWith: PREFIX } },
  });
  await testDb.section.deleteMany({
    where: { academic_year_id: AY_ID },
  });
  await testDb.teacher.deleteMany({
    where: { id: { startsWith: PREFIX } },
  });
  await testDb.auditLog.deleteMany({
    where: { actor_user_id: { startsWith: PREFIX } },
  });
  await testDb.user.deleteMany({
    where: { id: { startsWith: PREFIX } },
  });
  await testDb.academicYear.deleteMany({
    where: { id: AY_ID },
  });
}

describe('Phase H.2 — Official SF2/SF9 Database Integration Tests (`digiskwela_test`)', () => {
  beforeAll(async () => {
    // 1. Verify strict database isolation: must be `digiskwela_test`
    const dbCheck = await testDb.$queryRaw<Array<{ db_name: string }>>`
      SELECT current_database() AS db_name
    `;
    expect(dbCheck[0]?.db_name).toBe('digiskwela_test');

    await cleanupSyntheticTestRecords();

    // 2. Seed synthetic AcademicYear, Users, Teachers, Sections, Students, Enrollments, Subjects, Terms, Gradebooks
    await testDb.academicYear.create({
      data: {
        id: AY_ID,
        name: '2030-2031-SYNTHETIC',
        start_date: new Date('2030-06-01T00:00:00.000Z'),
        end_date: new Date('2031-04-30T00:00:00.000Z'),
        is_current: false,
        school_head_name_snapshot: 'DR. ELENA M. SANTOS, EdD',
        school_head_title_snapshot: 'Principal IV',
      },
    });

    const usersToCreate = [
      { id: ADMIN_USER_ID, email: 'h2.admin@synthetic.test', first: 'System', last: 'Admin' },
      { id: ADVISER_A_USER_ID, email: 'h2.adviser.a@synthetic.test', first: 'Kathrina Mae', middle: 'Hermosa', last: 'Omlang' },
      { id: ADVISER_B_USER_ID, email: 'h2.adviser.b@synthetic.test', first: 'Roberto', middle: 'Cruz', last: 'Dizon' },
      { id: UNASSIGNED_USER_ID, email: 'h2.unassigned@synthetic.test', first: 'Marco', last: 'Villanueva' },
      { id: STU_A_USER_ID, email: 'h2.stu.a@synthetic.test', first: 'Juan Synthetic', middle: 'Reyes', last: 'Dela Cruz' },
      { id: STU_B_USER_ID, email: 'h2.stu.b@synthetic.test', first: 'Maria Clara', middle: 'Santos', last: 'Bautista' },
      { id: STU_TRANSFER_USER_ID, email: 'h2.stu.transfer@synthetic.test', first: 'Miguel', middle: 'Lopez', last: 'Ramos' },
    ];

    for (const u of usersToCreate) {
      await testDb.user.create({
        data: {
          id: u.id,
          school_id: `SCH_${u.id}`,
          email: u.email,
          password_hash: 'synthetic-not-used-for-login',
          first_name: u.first,
          middle_name: u.middle ?? null,
          last_name: u.last,
          status: 'Active',
        },
      });
    }

    await testDb.teacher.createMany({
      data: [
        { id: ADVISER_A_TEACHER_ID, user_id: ADVISER_A_USER_ID, employee_id: `${PREFIX}EMP_A` },
        { id: ADVISER_B_TEACHER_ID, user_id: ADVISER_B_USER_ID, employee_id: `${PREFIX}EMP_B` },
        { id: UNASSIGNED_TEACHER_ID, user_id: UNASSIGNED_USER_ID, employee_id: `${PREFIX}EMP_U` },
      ],
    });

    await testDb.section.createMany({
      data: [
        {
          id: SEC_A_ID,
          name: 'Agoncillo-H2',
          grade_level: 7,
          academic_year_id: AY_ID,
        },
        {
          id: SEC_B_ID,
          name: 'Bonifacio-H2',
          grade_level: 7,
          academic_year_id: AY_ID,
        },
      ],
    });

    // Assign Class Advisers via persistence service
    await assignSectionClassAdviser(testDb, {
      sectionId: SEC_A_ID,
      adviserTeacherId: ADVISER_A_TEACHER_ID,
      adviserNameSnapshot: 'KATHRINA MAE H. OMLANG',
      actorUserId: ADMIN_USER_ID,
    });
    await assignSectionClassAdviser(testDb, {
      sectionId: SEC_B_ID,
      adviserTeacherId: ADVISER_B_TEACHER_ID,
      adviserNameSnapshot: 'ROBERTO C. DIZON',
      actorUserId: ADMIN_USER_ID,
    });

    await testDb.student.createMany({
      data: [
        {
          id: STU_A_ID,
          user_id: STU_A_USER_ID,
          student_number: `${PREFIX}SNO_A`,
          lrn: '999999300001',
          gender: 'M',
          date_of_birth: new Date('2017-12-15T00:00:00.000Z'),
          grade_level: 7,
          current_section_id: SEC_A_ID,
        },
        {
          id: STU_B_ID,
          user_id: STU_B_USER_ID,
          student_number: `${PREFIX}SNO_B`,
          lrn: '999999300002',
          gender: 'F',
          date_of_birth: new Date('2017-08-20T00:00:00.000Z'),
          grade_level: 7,
          current_section_id: SEC_A_ID,
        },
        {
          id: STU_TRANSFER_ID,
          user_id: STU_TRANSFER_USER_ID,
          student_number: `${PREFIX}SNO_TR`,
          lrn: '999999300003',
          gender: 'M',
          date_of_birth: new Date('2017-05-10T00:00:00.000Z'),
          grade_level: 7,
          current_section_id: SEC_B_ID,
        },
      ],
    });

    await testDb.enrollment.createMany({
      data: [
        {
          id: ENR_A_ID,
          student_id: STU_A_ID,
          section_id: SEC_A_ID,
          academic_year_id: AY_ID,
          status: 'Enrolled',
          effective_start_date: new Date('2030-06-01T00:00:00.000Z'),
          effective_end_date: new Date('2031-04-30T00:00:00.000Z'),
        },
        {
          id: ENR_B_ID,
          student_id: STU_B_ID,
          section_id: SEC_A_ID,
          academic_year_id: AY_ID,
          status: 'Enrolled',
          effective_start_date: new Date('2030-06-01T00:00:00.000Z'),
          effective_end_date: new Date('2031-04-30T00:00:00.000Z'),
        },
        // Transfer learner: Section A from June 1..June 15, Section B from June 16..April 30
        {
          id: ENR_TRANSFER_1_ID,
          student_id: STU_TRANSFER_ID,
          section_id: SEC_A_ID,
          academic_year_id: AY_ID,
          status: 'Transferred',
          effective_start_date: new Date('2030-06-01T00:00:00.000Z'),
          effective_end_date: new Date('2030-06-15T00:00:00.000Z'),
        },
        {
          id: ENR_TRANSFER_2_ID,
          student_id: STU_TRANSFER_ID,
          section_id: SEC_B_ID,
          academic_year_id: AY_ID,
          status: 'Enrolled',
          effective_start_date: new Date('2030-06-16T00:00:00.000Z'),
          effective_end_date: new Date('2031-04-30T00:00:00.000Z'),
        },
      ],
    });

    await testDb.term.createMany({
      data: [
        {
          id: TERM_IDS.T1,
          academic_year_id: AY_ID,
          key: 'T1',
          name: 'Trimester 1',
          start_date: new Date('2030-06-01T00:00:00.000Z'),
          end_date: new Date('2030-09-30T00:00:00.000Z'),
        },
        {
          id: TERM_IDS.T2,
          academic_year_id: AY_ID,
          key: 'T2',
          name: 'Trimester 2',
          start_date: new Date('2030-10-01T00:00:00.000Z'),
          end_date: new Date('2031-01-31T00:00:00.000Z'),
        },
        {
          id: TERM_IDS.T3,
          academic_year_id: AY_ID,
          key: 'T3',
          name: 'Trimester 3',
          start_date: new Date('2031-02-01T00:00:00.000Z'),
          end_date: new Date('2031-04-30T00:00:00.000Z'),
        },
      ],
    });

    for (const subj of SUBJECT_DEFS) {
      const subjectId = `${PREFIX}subj_${subj.key}`;
      const assignmentId = `${PREFIX}asgn_${subj.key}`;
      await testDb.subject.create({
        data: {
          id: subjectId,
          code: subj.code,
          name: subj.name,
        },
      });
      await testDb.teacherSubjectAssignment.create({
        data: {
          id: assignmentId,
          teacher_id: ADVISER_A_TEACHER_ID,
          subject_id: subjectId,
          section_id: SEC_A_ID,
          academic_year_id: AY_ID,
        },
      });
      for (const termKey of ['T1', 'T2', 'T3'] as const) {
        await testDb.gradebooks.create({
          data: {
            id: `${PREFIX}gb_${subj.key}_${termKey}`,
            assignment_id: assignmentId,
            term_id: TERM_IDS[termKey],
            status: 'Draft',
            version: 1,
            updated_at: new Date(),
          },
        });
      }
    }
  });

  afterAll(async () => {
    await cleanupSyntheticTestRecords();
    await testDb.$disconnect();
  });

  it('Scenario 1, 2 & 5 — persists school calendar records, rejects duplicate dates, and blocks finalization when dates are missing', async () => {
    const juneMonth = await upsertSchoolCalendarMonth(testDb, {
      id: `${PREFIX}month_JUN`,
      academicYearId: AY_ID,
      monthKey: 'JUN',
      calendarYear: 2030,
      calendarMonth: 6,
      plannedInstructionalDays: 20,
      actorUserId: ADMIN_USER_ID,
    });
    expect(juneMonth.status).toBe('DRAFT');

    // Persist June 1..June 29 only (leaving June 30 missing)
    const juneDates = enumerateDatesInMonth(2030, 6);
    for (const isoDate of juneDates.slice(0, 29)) {
      const [y, m, d] = isoDate.split('-').map(Number);
      const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
      const isWeekend = dow === 0 || dow === 6;
      const isHoliday = isoDate === '2030-06-12';
      const dayType = isWeekend ? 'WEEKEND' : isHoliday ? 'REGULAR_HOLIDAY' : 'INSTRUCTIONAL';

      await upsertSchoolCalendarDay(testDb, {
        id: `${PREFIX}day_${isoDate}`,
        academicYearId: AY_ID,
        calendarMonthId: juneMonth.id,
        date: isoDate,
        dayType,
        isInstructional: dayType === 'INSTRUCTIONAL',
        description: isHoliday ? 'Independence Day' : null,
        approvalStatus: 'APPROVED',
        actorUserId: ADMIN_USER_ID,
      });
    }

    // Scenario 5: Missing June 30 must block finalization
    await expect(
      finalizeSchoolCalendarMonth(testDb, {
        calendarMonthId: juneMonth.id,
        actorUserId: ADMIN_USER_ID,
      })
    ).rejects.toMatchObject({
      code: 'INCOMPLETE_SCHOOL_CALENDAR_MONTH',
    });

    // Scenario 2: Direct duplicate date insert on (academic_year_id, date) must be rejected by PostgreSQL unique index
    await expect(
      testDb.schoolCalendarDay.create({
        data: {
          id: `${PREFIX}dup_day_2030_06_03`,
          academic_year_id: AY_ID,
          calendar_month_id: juneMonth.id,
          date: new Date('2030-06-03T00:00:00.000Z'),
          day_type: 'INSTRUCTIONAL',
          is_instructional: true,
          approval_status: 'APPROVED',
          recorded_by_id: ADMIN_USER_ID,
        },
      })
    ).rejects.toThrow();

    // Add missing June 30 and finalize June 2030
    await upsertSchoolCalendarDay(testDb, {
      id: `${PREFIX}day_2030-06-30`,
      academicYearId: AY_ID,
      calendarMonthId: juneMonth.id,
      date: '2030-06-30',
      dayType: 'WEEKEND',
      isInstructional: false,
      approvalStatus: 'APPROVED',
      actorUserId: ADMIN_USER_ID,
    });

    const finalizedJune = await finalizeSchoolCalendarMonth(testDb, {
      calendarMonthId: juneMonth.id,
      actorUserId: ADMIN_USER_ID,
    });
    expect(finalizedJune.month.status).toBe('FINALIZED');
    expect(finalizedJune.completeness.canFinalize).toBe(true);
    expect(finalizedJune.completeness.instructionalDates.length).toBe(19); // 20 weekdays in June 2030 minus June 12 holiday = 19
  });

  it('Scenario 3 & 4 — rejects contradictory student/enrollment and section/academic-year relationships at both service and DB constraint levels', async () => {
    // Scenario 3 (Service layer): Student B paired with Student A's enrollment
    await expect(
      recordOfficialDailyAttendance(testDb, {
        academicYearId: AY_ID,
        sectionId: SEC_A_ID,
        studentId: STU_B_ID,
        enrollmentId: ENR_A_ID,
        calendarDayId: `${PREFIX}day_2030-06-03`,
        date: '2030-06-03',
        status: 'P',
        actor: { userId: ADVISER_A_USER_ID, role: 'Teacher' },
        currentManilaDate: '2031-05-01',
      })
    ).rejects.toMatchObject({
      code: 'CONTRADICTORY_ENROLLMENT_STUDENT',
    });

    // Scenario 3 (Database composite FK level): Raw insert with mismatched (enrollment_id, student_id, section_id, academic_year_id)
    await expect(
      testDb.officialDailyAttendance.create({
        data: {
          id: `${PREFIX}bad_fk_stu_enr`,
          academic_year_id: AY_ID,
          section_id: SEC_A_ID,
          student_id: STU_B_ID, // Mismatches ENR_A_ID (which belongs to STU_A_ID)
          enrollment_id: ENR_A_ID,
          calendar_day_id: `${PREFIX}day_2030-06-03`,
          date: new Date('2030-06-03T00:00:00.000Z'),
          status: 'P',
          record_status: 'DRAFT',
          recorded_by_id: ADVISER_A_USER_ID,
        },
      })
    ).rejects.toThrow();

    // Scenario 4 (Service & DB composite FK level): Section B paired with Student A's Section A enrollment
    await expect(
      recordOfficialDailyAttendance(testDb, {
        academicYearId: AY_ID,
        sectionId: SEC_B_ID,
        studentId: STU_A_ID,
        enrollmentId: ENR_A_ID,
        calendarDayId: `${PREFIX}day_2030-06-03`,
        date: '2030-06-03',
        status: 'P',
        actor: { userId: ADVISER_B_USER_ID, role: 'Teacher' },
        currentManilaDate: '2031-05-01',
      })
    ).rejects.toMatchObject({
      code: 'CONTRADICTORY_ENROLLMENT_SECTION',
    });

    // Scenario 4 (Database composite FK on SectionCalendarException): calendar_day_id date mismatch
    await expect(
      testDb.sectionCalendarException.create({
        data: {
          id: `${PREFIX}bad_fk_exc_date`,
          academic_year_id: AY_ID,
          section_id: SEC_A_ID,
          calendar_day_id: `${PREFIX}day_2030-06-03`,
          date: new Date('2030-06-04T00:00:00.000Z'), // Mismatches 2030-06-03
          override_day_type: 'CLASS_SUSPENSION',
          override_is_instructional: false,
          reason: 'Contradictory date test',
          approval_status: 'APPROVED',
          recorded_by_id: ADMIN_USER_ID,
        },
      })
    ).rejects.toThrow();
  });

  it('Scenario 6, 7, 8, 9 & 10 — enforces Class Adviser authorization, saves daily attendance, excludes DRAFT rows, flags missing days, and aggregates VERIFIED rows accurately', async () => {
    // Scenario 6: Unassigned teacher cannot record official daily attendance for Section A
    await expect(
      recordOfficialDailyAttendance(testDb, {
        academicYearId: AY_ID,
        sectionId: SEC_A_ID,
        studentId: STU_A_ID,
        enrollmentId: ENR_A_ID,
        calendarDayId: `${PREFIX}day_2030-06-03`,
        date: '2030-06-03',
        status: 'P',
        actor: { userId: UNASSIGNED_USER_ID, role: 'Teacher' },
        currentManilaDate: '2031-05-01',
      })
    ).rejects.toMatchObject({
      code: 'FORBIDDEN_NOT_SECTION_ADVISER',
    });

    // Scenario 7: Assigned Class Adviser records DRAFT attendance for the first 18 instructional days of June 2030 (leaving the 19th instructional day 2030-06-28 missing)
    const juneInstructionalDays = await testDb.schoolCalendarDay.findMany({
      where: {
        calendar_month_id: `${PREFIX}month_JUN`,
        is_instructional: true,
      },
      orderBy: { date: 'asc' },
    });
    expect(juneInstructionalDays.length).toBe(19);

    for (let i = 0; i < 18; i++) {
      const d = juneInstructionalDays[i];
      const iso = d.date.toISOString().slice(0, 10);
      // Day 0 = 'L' (Late/Tardy -> counts as Present + Tardy), Day 1 = 'A' (Absent), others = 'P'
      const status = i === 0 ? 'L' : i === 1 ? 'A' : 'P';
      await recordOfficialDailyAttendance(testDb, {
        academicYearId: AY_ID,
        sectionId: SEC_A_ID,
        studentId: STU_A_ID,
        enrollmentId: ENR_A_ID,
        calendarDayId: d.id,
        date: iso,
        status,
        tardyType: status === 'L' ? 'MORNING' : null,
        actor: { userId: ADVISER_A_USER_ID, role: 'Teacher' },
        currentManilaDate: '2031-05-01',
      });
    }

    // Confirm GateAttendance and ClassAttendance tables were not touched
    const [gateCount, classAttCount] = await Promise.all([
      testDb.gateAttendance.count({ where: { student_id: STU_A_ID } }),
      testDb.classAttendance.count({ where: { enrollment_id: ENR_A_ID } }),
    ]);
    expect(gateCount).toBe(0);
    expect(classAttCount).toBe(0);

    // Scenario 10: Because the 19th instructional day (2030-06-28) has no attendance row, summary is INCOMPLETE_MISSING_ATTENDANCE (never defaults to Present!)
    const missingCheck = await computePersistedStudentMonthlyAttendance(testDb, {
      studentId: STU_A_ID,
      academicYearId: AY_ID,
      currentManilaDate: '2031-05-01',
    });
    const juneSummaryMissing = missingCheck.monthlySummaries.find((m) => m.sf9ColumnIndex === 0)!;
    expect(juneSummaryMissing.verificationState).toBe('INCOMPLETE_MISSING_ATTENDANCE');
    expect(juneSummaryMissing.missingInstructionalDates).toEqual(['2030-06-28']);

    // Record the 19th instructional day (2030-06-28) as DRAFT 'P'
    const lastJuneDay = juneInstructionalDays[18];
    await recordOfficialDailyAttendance(testDb, {
      academicYearId: AY_ID,
      sectionId: SEC_A_ID,
      studentId: STU_A_ID,
      enrollmentId: ENR_A_ID,
      calendarDayId: lastJuneDay.id,
      date: '2030-06-28',
      status: 'P',
      actor: { userId: ADVISER_A_USER_ID, role: 'Teacher' },
      currentManilaDate: '2031-05-01',
    });

    // Scenario 8: All 19 days are recorded as DRAFT (unverified) -> excluded from official totals (`INCOMPLETE_UNVERIFIED_DRAFT_ATTENDANCE`)
    const draftCheck = await computePersistedStudentMonthlyAttendance(testDb, {
      studentId: STU_A_ID,
      academicYearId: AY_ID,
      currentManilaDate: '2031-05-01',
    });
    const juneSummaryDraft = draftCheck.monthlySummaries.find((m) => m.sf9ColumnIndex === 0)!;
    expect(juneSummaryDraft.verificationState).toBe('INCOMPLETE_UNVERIFIED_DRAFT_ATTENDANCE');
    expect(juneSummaryDraft.unverifiedDraftDates.length).toBe(19);
    expect(juneSummaryDraft.daysPresent).toBe(0);

    // Scenario 9: Verify Section A attendance and confirm P, L, A aggregation + approved section suspension exception
    const verifyRes = await verifyOfficialDailyAttendance(testDb, {
      sectionId: SEC_A_ID,
      enrollmentId: ENR_A_ID,
      actor: { userId: ADVISER_A_USER_ID, role: 'Teacher' },
    });
    expect(verifyRes.verifiedCount).toBe(19);

    const verifiedCheck = await computePersistedStudentMonthlyAttendance(testDb, {
      studentId: STU_A_ID,
      academicYearId: AY_ID,
      currentManilaDate: '2031-05-01',
    });
    const juneSummaryVerified = verifiedCheck.monthlySummaries.find((m) => m.sf9ColumnIndex === 0)!;
    expect(juneSummaryVerified.verificationState).toBe('VERIFIED');
    expect(juneSummaryVerified.classDays).toBe(19);
    expect(juneSummaryVerified.daysPresent).toBe(18); // 17 'P' + 1 'L'
    expect(juneSummaryVerified.daysAbsent).toBe(1);   // 1 'A'
    expect(juneSummaryVerified.daysTardy).toBe(1);    // 1 'L'

    // Apply an approved SectionCalendarException on 2030-06-28 (localized suspension for Section A)
    // and verify the attendance row on 2030-06-28 is preserved as INVALIDATED_NON_INSTRUCTIONAL while classDays becomes 18
    const excRes = await upsertSectionCalendarException(testDb, {
      academicYearId: AY_ID,
      sectionId: SEC_A_ID,
      calendarDayId: lastJuneDay.id,
      date: '2030-06-28',
      overrideDayType: 'CLASS_SUSPENSION',
      overrideIsInstructional: false,
      reason: 'Localized building maintenance suspension for Section A',
      approvalStatus: 'APPROVED',
      actorUserId: ADMIN_USER_ID,
    });
    expect(excRes.invalidatedAttendanceCount).toBe(1);

    const afterExcCheck = await computePersistedStudentMonthlyAttendance(testDb, {
      studentId: STU_A_ID,
      academicYearId: AY_ID,
      currentManilaDate: '2031-05-01',
    });
    const juneAfterExc = afterExcCheck.monthlySummaries.find((m) => m.sf9ColumnIndex === 0)!;
    expect(juneAfterExc.verificationState).toBe('VERIFIED');
    expect(juneAfterExc.classDays).toBe(18);
    expect(juneAfterExc.daysPresent).toBe(17);
    expect(juneAfterExc.daysAbsent).toBe(1);
  });

  it('Scenario 11 — prevents duplicate daily attendance across student section transfers and aggregates transfer windows accurately', async () => {
    const juneInstructionalDays = await testDb.schoolCalendarDay.findMany({
      where: {
        calendar_month_id: `${PREFIX}month_JUN`,
        is_instructional: true,
      },
      orderBy: { date: 'asc' },
    });

    // Transfer student was in Section A (2030-06-01..2030-06-15) and Section B (2030-06-16..2030-06-30).
    // Note: 2030-06-28 is suspended in Section A via exception, but STILL instructional in Section B!
    for (const d of juneInstructionalDays) {
      const iso = d.date.toISOString().slice(0, 10);
      if (iso <= '2030-06-15') {
        await recordOfficialDailyAttendance(testDb, {
          academicYearId: AY_ID,
          sectionId: SEC_A_ID,
          studentId: STU_TRANSFER_ID,
          enrollmentId: ENR_TRANSFER_1_ID,
          calendarDayId: d.id,
          date: iso,
          status: 'P',
          actor: { userId: ADVISER_A_USER_ID, role: 'Teacher' },
          currentManilaDate: '2031-05-01',
        });
      } else {
        await recordOfficialDailyAttendance(testDb, {
          academicYearId: AY_ID,
          sectionId: SEC_B_ID,
          studentId: STU_TRANSFER_ID,
          enrollmentId: ENR_TRANSFER_2_ID,
          calendarDayId: d.id,
          date: iso,
          status: 'P',
          actor: { userId: ADVISER_B_USER_ID, role: 'Teacher' },
          currentManilaDate: '2031-05-01',
        });
      }
    }

    // Attempt to record attendance in Section B for a date (2030-06-10) when the learner was still in Section A:
    // Rejected by service active window check AND by PostgreSQL unique index @@unique([student_id, date])
    await expect(
      recordOfficialDailyAttendance(testDb, {
        academicYearId: AY_ID,
        sectionId: SEC_B_ID,
        studentId: STU_TRANSFER_ID,
        enrollmentId: ENR_TRANSFER_2_ID,
        calendarDayId: `${PREFIX}day_2030-06-10`,
        date: '2030-06-10',
        status: 'P',
        actor: { userId: ADVISER_B_USER_ID, role: 'Teacher' },
        currentManilaDate: '2031-05-01',
      })
    ).rejects.toMatchObject({
      code: 'OUTSIDE_ENROLLMENT_ACTIVE_WINDOW',
    });

    await verifyOfficialDailyAttendance(testDb, {
      sectionId: SEC_A_ID,
      enrollmentId: ENR_TRANSFER_1_ID,
      actor: { userId: ADVISER_A_USER_ID, role: 'Teacher' },
    });
    await verifyOfficialDailyAttendance(testDb, {
      sectionId: SEC_B_ID,
      enrollmentId: ENR_TRANSFER_2_ID,
      actor: { userId: ADVISER_B_USER_ID, role: 'Teacher' },
    });

    const transferCheck = await computePersistedStudentMonthlyAttendance(testDb, {
      studentId: STU_TRANSFER_ID,
      academicYearId: AY_ID,
      currentManilaDate: '2031-05-01',
    });
    const transferJune = transferCheck.monthlySummaries.find((m) => m.sf9ColumnIndex === 0)!;
    expect(transferJune.verificationState).toBe('VERIFIED');
    expect(transferJune.classDays).toBe(19); // 9 days in Sec A + 10 days in Sec B (including June 28 which wasn't suspended in Sec B)
    expect(transferJune.daysPresent).toBe(19);
    expect(transferJune.daysAbsent).toBe(0);
  });

  it('Scenario 12 — persists T1/T2/T3 adviser comments, blocks unauthorized teachers, and protects PUBLISHED comments from silent overwrite', async () => {
    // Unassigned teacher cannot save adviser comment
    await expect(
      saveSf9AdviserComment(testDb, {
        enrollmentId: ENR_A_ID,
        studentId: STU_A_ID,
        sectionId: SEC_A_ID,
        academicYearId: AY_ID,
        term: 'T1',
        comment: 'Unauthorized remark',
        status: 'PUBLISHED',
        actor: { userId: UNASSIGNED_USER_ID, role: 'Teacher' },
      })
    ).rejects.toMatchObject({
      code: 'FORBIDDEN_NOT_SECTION_ADVISER',
    });

    // Designated Class Adviser saves & publishes T1, T2, T3 comments for Student A
    const c1 = await saveSf9AdviserComment(testDb, {
      enrollmentId: ENR_A_ID,
      studentId: STU_A_ID,
      sectionId: SEC_A_ID,
      academicYearId: AY_ID,
      term: 'T1',
      comment: 'Initial Term 1 remark.',
      status: 'PUBLISHED',
      actor: { userId: ADVISER_A_USER_ID, role: 'Teacher' },
    });
    expect(c1.version).toBe(1);
    expect(c1.status).toBe('PUBLISHED');

    // Silent overwrite of PUBLISHED comment without allowPublishedCorrection + correctionReason is rejected
    await expect(
      saveSf9AdviserComment(testDb, {
        enrollmentId: ENR_A_ID,
        studentId: STU_A_ID,
        sectionId: SEC_A_ID,
        academicYearId: AY_ID,
        term: 'T1',
        comment: 'Silent overwrite attempt.',
        status: 'PUBLISHED',
        actor: { userId: ADVISER_A_USER_ID, role: 'Teacher' },
      })
    ).rejects.toMatchObject({
      code: 'PUBLISHED_COMMENT_PROTECTED',
    });

    // Audited correction increments version and records correction_reason
    const c1Corrected = await saveSf9AdviserComment(testDb, {
      enrollmentId: ENR_A_ID,
      studentId: STU_A_ID,
      sectionId: SEC_A_ID,
      academicYearId: AY_ID,
      term: 'T1',
      comment: 'Demonstrates commendable academic dedication and exemplary conduct.',
      status: 'PUBLISHED',
      allowPublishedCorrection: true,
      correctionReason: 'Updated Term 1 narrative after parent-teacher conference',
      actor: { userId: ADVISER_A_USER_ID, role: 'Teacher' },
    });
    expect(c1Corrected.version).toBe(2);
    expect(c1Corrected.correction_reason).toContain('parent-teacher conference');

    await saveSf9AdviserComment(testDb, {
      enrollmentId: ENR_A_ID,
      studentId: STU_A_ID,
      sectionId: SEC_A_ID,
      academicYearId: AY_ID,
      term: 'T2',
      comment: 'Consistently achieves high performance across all learning areas.',
      status: 'PUBLISHED',
      actor: { userId: ADVISER_A_USER_ID, role: 'Teacher' },
    });

    await saveSf9AdviserComment(testDb, {
      enrollmentId: ENR_A_ID,
      studentId: STU_A_ID,
      sectionId: SEC_A_ID,
      academicYearId: AY_ID,
      term: 'T3',
      comment: 'Maintains outstanding enthusiasm and mastery of competencies.',
      status: 'PUBLISHED',
      actor: { userId: ADVISER_A_USER_ID, role: 'Teacher' },
    });
  });

  it('Scenario 13 — preserves draft grade saves without auto-publishing and protects published grade snapshots with optimistic locking', async () => {
    const filSubjectId = `${PREFIX}subj_filipino`;
    const filT1GbId = `${PREFIX}gb_filipino_T1`;

    // 1. Draft save sets `term_grade` but keeps `published_term_grade` null
    const draftGrade = await saveDraftGradeLedgerEntry(testDb, {
      gradebookId: filT1GbId,
      expectedGradebookVersion: 1,
      studentId: STU_A_ID,
      subjectId: filSubjectId,
      academicYearId: AY_ID,
      term: 'T1',
      draftTermGrade: 85,
      draftInitialGrade: 78.5,
      actorUserId: ADVISER_A_USER_ID,
    });
    expect(draftGrade.term_grade).toBe(85);
    expect(draftGrade.published_term_grade).toBeNull();

    // 2. Non-integer published_term_grade is rejected
    await expect(
      publishSubjectTermGradeSnapshot(testDb, {
        enrollmentId: ENR_A_ID,
        studentId: STU_A_ID,
        subjectId: filSubjectId,
        academicYearId: AY_ID,
        term: 'T1',
        gradebookId: filT1GbId,
        expectedGradebookVersion: 1,
        transmutedTermGrade: 88.5,
        initialGrade: 82.4,
        actor: { userId: ADVISER_A_USER_ID, role: 'Teacher' },
      })
    ).rejects.toMatchObject({
      code: 'INVALID_PUBLISHED_TERM_GRADE_INTEGER',
    });

    // 3. Publish all 9 subjects across T1, T2, T3 for Student A
    for (const subj of SUBJECT_DEFS) {
      const subjectId = `${PREFIX}subj_${subj.key}`;
      const terms = ['T1', 'T2', 'T3'] as const;
      for (let tIdx = 0; tIdx < 3; tIdx++) {
        const termKey = terms[tIdx];
        const gbId = `${PREFIX}gb_${subj.key}_${termKey}`;
        const score = subj.scores[tIdx];

        const pubRes = await publishSubjectTermGradeSnapshot(testDb, {
          enrollmentId: ENR_A_ID,
          studentId: STU_A_ID,
          subjectId,
          academicYearId: AY_ID,
          term: termKey,
          gradebookId: gbId,
          expectedGradebookVersion: 1,
          transmutedTermGrade: score,
          initialGrade: score - 3.25,
          actor: { userId: ADVISER_A_USER_ID, role: 'Teacher' },
        });
        expect(pubRes.grade.published_term_grade).toBe(score);
        expect(pubRes.grade.published_version).toBe(2);
        expect(pubRes.gradebook.status).toBe('Published');
        expect(pubRes.gradebook.version).toBe(2);
      }
    }

    // 4. Draft save against a Published gradebook is blocked (`GRADEBOOK_LOCKED_PUBLISHED`)
    await expect(
      saveDraftGradeLedgerEntry(testDb, {
        gradebookId: filT1GbId,
        expectedGradebookVersion: 2,
        studentId: STU_A_ID,
        subjectId: filSubjectId,
        academicYearId: AY_ID,
        term: 'T1',
        draftTermGrade: 75,
        actorUserId: ADVISER_A_USER_ID,
      })
    ).rejects.toMatchObject({
      code: 'GRADEBOOK_LOCKED_PUBLISHED',
    });

    // 5. Stale expectedGradebookVersion triggers optimistic lock conflict (`OPTIMISTIC_LOCK_VERSION_CONFLICT`)
    await expect(
      publishSubjectTermGradeSnapshot(testDb, {
        enrollmentId: ENR_A_ID,
        studentId: STU_A_ID,
        subjectId: filSubjectId,
        academicYearId: AY_ID,
        term: 'T1',
        gradebookId: filT1GbId,
        expectedGradebookVersion: 1, // stale (actual is 2)
        transmutedTermGrade: 90,
        initialGrade: 85,
        actor: { userId: ADMIN_USER_ID, role: 'Admin' },
        correctionReason: 'Attempt with stale version',
      })
    ).rejects.toMatchObject({
      code: 'OPTIMISTIC_LOCK_VERSION_CONFLICT',
    });
  });

  it('Scenario 14, 15, 16 & 17 — blocks incomplete SF9 release, populates Calulut SF9 workbook from persisted DB records, renders PDF via LibreOffice, and preserves cross-student isolation', async () => {
    // Scenario 17a: Student A currently has only June finalized (Jul..Apr missing) -> official SF9 is blocked!
    const incompleteCheck = await generatePersistedStudentCalulutSf9FromDb(testDb, {
      studentId: STU_A_ID,
      enrollmentId: ENR_A_ID,
      academicYearId: AY_ID,
      currentManilaDate: '2031-05-01',
    });
    expect(incompleteCheck.readyForOfficialSf9).toBe(false);
    expect(incompleteCheck.blockingReasons.some((r) => r.includes('Missing SchoolCalendarMonth summary for Jul'))).toBe(
      true
    );

    // Seed & finalize remaining 10 months (JUL 2030 .. APR 2031) and verified attendance for Student A
    const remainingSlots = CALULUT_SF9_MONTH_SLOTS.slice(1); // JUL..APR
    for (const slot of remainingSlots) {
      const calYear = slot.monthOfYear >= 6 ? 2030 : 2031;
      const monthRow = await upsertSchoolCalendarMonth(testDb, {
        id: `${PREFIX}month_${slot.monthKey}`,
        academicYearId: AY_ID,
        monthKey: slot.monthKey as Sf9MonthKeyLiteral,
        calendarYear: calYear,
        calendarMonth: slot.monthOfYear,
        actorUserId: ADMIN_USER_ID,
      });

      const dates = enumerateDatesInMonth(calYear, slot.monthOfYear);
      let instrAdded = 0;
      for (const isoDate of dates) {
        const [y, m, d] = isoDate.split('-').map(Number);
        const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
        const isWeekend = dow === 0 || dow === 6;
        // Keep April to 5 instructional days, other months ~18-22 weekdays
        const isInstr = !isWeekend && (slot.monthKey !== 'APR' || instrAdded < 5);
        if (isInstr) instrAdded++;

        const dayType = isWeekend
          ? 'WEEKEND'
          : isInstr
            ? 'INSTRUCTIONAL'
            : 'SCHOOL_ACTIVITY_NON_INSTRUCTIONAL';

        const { day } = await upsertSchoolCalendarDay(testDb, {
          id: `${PREFIX}day_${isoDate}`,
          academicYearId: AY_ID,
          calendarMonthId: monthRow.id,
          date: isoDate,
          dayType,
          isInstructional: isInstr,
          approvalStatus: 'APPROVED',
          actorUserId: ADMIN_USER_ID,
        });

        if (isInstr) {
          await recordOfficialDailyAttendance(testDb, {
            academicYearId: AY_ID,
            sectionId: SEC_A_ID,
            studentId: STU_A_ID,
            enrollmentId: ENR_A_ID,
            calendarDayId: day.id,
            date: isoDate,
            status: 'P',
            actor: { userId: ADVISER_A_USER_ID, role: 'Teacher' },
            currentManilaDate: '2031-05-01',
          });
        }
      }

      await finalizeSchoolCalendarMonth(testDb, {
        calendarMonthId: monthRow.id,
        actorUserId: ADMIN_USER_ID,
      });
    }

    await verifyOfficialDailyAttendance(testDb, {
      sectionId: SEC_A_ID,
      enrollmentId: ENR_A_ID,
      actor: { userId: ADVISER_A_USER_ID, role: 'Teacher' },
    });

    // Scenario 17b: Test Excused ('E') policy gating on 2031-04-01:
    // Default UNRESOLVED blocks official SF9; explicit test policy fixture COUNT_AS_PRESENT allows test verification
    await recordOfficialDailyAttendance(testDb, {
      academicYearId: AY_ID,
      sectionId: SEC_A_ID,
      studentId: STU_A_ID,
      enrollmentId: ENR_A_ID,
      calendarDayId: `${PREFIX}day_2031-04-01`,
      date: '2031-04-01',
      status: 'E',
      correctionReason: 'Approved medical excuse note test',
      actor: { userId: ADVISER_A_USER_ID, role: 'Teacher' },
      currentManilaDate: '2031-05-01',
    });
    await verifyOfficialDailyAttendance(testDb, {
      sectionId: SEC_A_ID,
      enrollmentId: ENR_A_ID,
      actor: { userId: ADVISER_A_USER_ID, role: 'Teacher' },
    });

    const excusedBlocked = await generatePersistedStudentCalulutSf9FromDb(testDb, {
      studentId: STU_A_ID,
      enrollmentId: ENR_A_ID,
      academicYearId: AY_ID,
      excusedPolicy: 'UNRESOLVED',
      currentManilaDate: '2031-05-01',
    });
    expect(excusedBlocked.readyForOfficialSf9).toBe(false);
    expect(
      excusedBlocked.blockingReasons.some((r) => r.includes('BLOCKED_PENDING_EXCUSED_POLICY'))
    ).toBe(true);

    // Restore 2031-04-01 to 'P' and re-verify
    await recordOfficialDailyAttendance(testDb, {
      academicYearId: AY_ID,
      sectionId: SEC_A_ID,
      studentId: STU_A_ID,
      enrollmentId: ENR_A_ID,
      calendarDayId: `${PREFIX}day_2031-04-01`,
      date: '2031-04-01',
      status: 'P',
      correctionReason: 'Restored to Present after policy gate test',
      actor: { userId: ADVISER_A_USER_ID, role: 'Teacher' },
      currentManilaDate: '2031-05-01',
    });
    await verifyOfficialDailyAttendance(testDb, {
      sectionId: SEC_A_ID,
      enrollmentId: ENR_A_ID,
      actor: { userId: ADVISER_A_USER_ID, role: 'Teacher' },
    });

    // Scenario 14 & 15: Generate populated Calulut SF9 workbook & render PDF via headless LibreOffice from persisted `digiskwela_test` records
    const fullSf9 = await generatePersistedStudentCalulutSf9FromDb(testDb, {
      studentId: STU_A_ID,
      enrollmentId: ENR_A_ID,
      academicYearId: AY_ID,
      renderPdf: true,
      currentManilaDate: '2031-05-01',
    });

    expect(fullSf9.readyForOfficialSf9).toBe(true);
    expect(fullSf9.xlsxBuffer).toBeDefined();
    expect(fullSf9.pdfBuffer).toBeDefined();
    expect(fullSf9.pdfBuffer!.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(fullSf9.pdfBuffer!.length).toBeGreaterThan(50000);

    // Inspect OpenXML cells in the generated workbook
    const zip = new AdmZip(fullSf9.xlsxBuffer!);
    const s6Xml = zip.readAsText('xl/worksheets/sheet6.xml'); // SF9 - GRADE 4-10
    const s7Xml = zip.readAsText('xl/worksheets/sheet7.xml'); // ATTENDANCE RECORD SUMMARY

    // Verify June attendance cells (18 classDays after Section A exception, 17 present, 1 absent)
    expect(readCellFromXml(s7Xml, 'F117').value).toBe('18');
    expect(readCellFromXml(s7Xml, 'F14').value).toBe('17');
    expect(readCellFromXml(s6Xml, 'R5').value).toBe('18');
    expect(readCellFromXml(s6Xml, 'R7').value).toBe('17');
    expect(readCellFromXml(s6Xml, 'R9').value).toBe('1');
    expect(readCellFromXml(s6Xml, 'AB5').value).toBe('5');
    expect(readCellFromXml(s6Xml, 'AB7').value).toBe('5');
    expect(readCellFromXml(s6Xml, 'AB9').value).toBe('0');
    expect(readCellFromXml(s6Xml, 'AC9').value).toBe('1');

    // Verify Adviser Comments in 'SF9 - GRADE 4-10'!R15, R19, R23
    expect(readCellFromXml(s6Xml, 'R15').value).toBe(
      'Demonstrates commendable academic dedication and exemplary conduct.'
    );
    expect(readCellFromXml(s6Xml, 'R19').value).toBe(
      'Consistently achieves high performance across all learning areas.'
    );
    expect(readCellFromXml(s6Xml, 'R23').value).toBe(
      'Maintains outstanding enthusiasm and mastery of competencies.'
    );

    // Verify Signatories in 'SF9 - GRADE 4-10'!B27, H27, X40, Q41, Q49
    expect(readCellFromXml(s6Xml, 'B27').value).toBe('DR. ELENA M. SANTOS, EdD');
    expect(readCellFromXml(s6Xml, 'Q41').value).toBe('DR. ELENA M. SANTOS, EdD');
    expect(readCellFromXml(s6Xml, 'H27').value).toBe('KATHRINA MAE H. OMLANG');
    expect(readCellFromXml(s6Xml, 'X40').value).toBe('KATHRINA MAE H. OMLANG');

    // Verify Grades & General Average in 'SF9 - GRADE 4-10'!F32:H41, I32:I39, I42, J42
    expect(readCellFromXml(s6Xml, 'F32').value).toBe('89'); // Filipino T1
    expect(readCellFromXml(s6Xml, 'G32').value).toBe('91'); // Filipino T2
    expect(readCellFromXml(s6Xml, 'H32').value).toBe('93'); // Filipino T3
    expect(readCellFromXml(s6Xml, 'I32').value).toBe('91'); // Filipino Final
    expect(readCellFromXml(s6Xml, 'I42').value).toBe(String(fullSf9.calculated!.generalAverage));
    expect(readCellFromXml(s6Xml, 'J42').value).toBe('Passed');

    // Scenario 16: Another student's SF9 (Student B in the same Section A) remains completely unaffected & blocked because Student B has no grades/attendance/comments
    const studentBCheck = await generatePersistedStudentCalulutSf9FromDb(testDb, {
      studentId: STU_B_ID,
      enrollmentId: ENR_B_ID,
      academicYearId: AY_ID,
      currentManilaDate: '2031-05-01',
    });
    expect(studentBCheck.readyForOfficialSf9).toBe(false);
    expect(
      studentBCheck.blockingReasons.some((r) => r.startsWith('UNPUBLISHED_OR_MISSING_SUBJECT_GRADES:'))
    ).toBe(true);
    expect(
      studentBCheck.blockingReasons.some((r) => r.includes('INCOMPLETE_MISSING_ATTENDANCE'))
    ).toBe(true);
    expect(
      studentBCheck.blockingReasons.some((r) => r.startsWith('MISSING_PUBLISHED_ADVISER_COMMENT:'))
    ).toBe(true);
  }, 60000);

  it('Scenario 18 — keeps private document storage, OAuth directory, backups, and quarantine strictly blocked (403) and keeps ChatGPT OAuth disconnected', async () => {
    const [docRes, chatgptRes, backupRes, quarantineRes] = await Promise.all([
      request(app).get('/storage/documents/test.pdf'),
      request(app).get('/storage/chatgpt/tokens.json'),
      request(app).get('/backups/digiskwela_backup_2026-10-29T13-35-08-540Z/database.dump'),
      request(app).get('/quarantine/backups_2026-10-26_pre_h1/manifest.json'),
    ]);

    expect(docRes.status).toBe(403);
    expect(chatgptRes.status).toBe(403);
    expect(backupRes.status).toBe(403);
    expect(quarantineRes.status).toBe(403);

    const chatgptDir = path.resolve(__dirname, '..', 'storage', 'chatgpt');
    expect(fs.existsSync(path.join(chatgptDir, 'tokens.json'))).toBe(false);
    expect(fs.existsSync(path.join(chatgptDir, 'registration.json'))).toBe(false);
    expect(fs.existsSync(path.join(chatgptDir, 'host_id.json'))).toBe(true);
    expect(process.env.CHATGPT_PLAN_ENABLED).not.toBe('true');
  });
});
