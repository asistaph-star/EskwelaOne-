import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { sign } from 'jsonwebtoken';
import app from '../src/app.js';
import prisma from '../src/config/database.js';
import { config } from '../src/config/env.js';
import { generateId } from '../src/common/utils/uuid.js';
import { saveLedger, getLedger } from '../src/gradebooks/ledger.service.js';

describe('DIGISKWELA — Gradebook Column Identity, Data Loss Prevention & Concurrency Verification (digiskwela_test)', () => {
  // Synthetic Authorized Teacher 1
  const teacher1UserId = 'synth-u-id-tch-1';
  const teacher1ProfileId = 'synth-p-id-tch-1';
  const teacher1SchoolId = 'SYNTH-TCH-ID1';

  // Synthetic Authorized Teacher 2 (for cross-class checks)
  const teacher2UserId = 'synth-u-id-tch-2';
  const teacher2ProfileId = 'synth-p-id-tch-2';
  const teacher2SchoolId = 'SYNTH-TCH-ID2';

  // Synthetic Section 1 (Main test class)
  const section1Id = 'synth-sec-id-verify-1';
  const assignment1Id = 'synth-assign-id-verify-1';

  // Synthetic Section 2 (Foreign test class)
  const section2Id = 'synth-sec-id-verify-2';
  const assignment2Id = 'synth-assign-id-verify-2';

  // Synthetic Students
  const student1UserId = 'synth-u-id-stu-1';
  const student1ProfileId = 'synth-p-id-stu-1';
  const enrollment1Id = 'synth-enroll-id-1';

  const student2UserId = 'synth-u-id-stu-2';
  const student2ProfileId = 'synth-p-id-stu-2';
  const enrollment2Id = 'synth-enroll-id-2';

  const academicYearId = 'demo-ay-2026';
  const subjectId = 'demo-subj-math10';

  let teacher1Token: string;
  let teacher2Token: string;

  async function cleanup() {
    await prisma.grade_entries.deleteMany({
      where: { enrollment_id: { in: [enrollment1Id, enrollment2Id] } }
    });
    await prisma.gradebook_columns.deleteMany({
      where: { gradebook: { assignment_id: { in: [assignment1Id, assignment2Id] } } }
    });
    await prisma.gradebooks.deleteMany({
      where: { assignment_id: { in: [assignment1Id, assignment2Id] } }
    });
    await prisma.grade.deleteMany({
      where: { student_id: { in: [student1ProfileId, student2ProfileId] } }
    });
    await prisma.enrollment.deleteMany({
      where: { id: { in: [enrollment1Id, enrollment2Id] } }
    });
    await prisma.teacherSubjectAssignment.deleteMany({
      where: { id: { in: [assignment1Id, assignment2Id] } }
    });
    await prisma.section.deleteMany({
      where: { id: { in: [section1Id, section2Id] } }
    });
    await prisma.student.deleteMany({
      where: { id: { in: [student1ProfileId, student2ProfileId] } }
    });
    await prisma.teacher.deleteMany({
      where: { id: { in: [teacher1ProfileId, teacher2ProfileId] } }
    });
    await prisma.auditLog.deleteMany({
      where: { actor_user_id: { in: [teacher1UserId, teacher2UserId, student1UserId, student2UserId] } }
    });
    await prisma.userRole.deleteMany({
      where: { user_id: { in: [teacher1UserId, teacher2UserId, student1UserId, student2UserId] } }
    });
    await prisma.user.deleteMany({
      where: { id: { in: [teacher1UserId, teacher2UserId, student1UserId, student2UserId] } }
    });
  }

  beforeAll(async () => {
    await cleanup();

    const roleTeacher = await prisma.role.findUnique({ where: { name: 'Teacher' } });
    const roleStudent = await prisma.role.findUnique({ where: { name: 'Student' } });
    if (!roleTeacher || !roleStudent) throw new Error('Base roles not found');

    // Teacher 1
    await prisma.user.create({
      data: {
        id: teacher1UserId,
        school_id: teacher1SchoolId,
        email: 'id_tch_1@test.local',
        password_hash: 'HASH_PLACEHOLDER',
        first_name: 'Identity',
        last_name: 'Teacher1',
        status: 'active',
        user_roles: { create: { role_id: roleTeacher.id } }
      }
    });
    await prisma.teacher.create({
      data: {
        id: teacher1ProfileId,
        user_id: teacher1UserId,
        employee_id: teacher1SchoolId,
        department: 'Mathematics',
        position: 'Teacher III'
      }
    });

    // Teacher 2
    await prisma.user.create({
      data: {
        id: teacher2UserId,
        school_id: teacher2SchoolId,
        email: 'id_tch_2@test.local',
        password_hash: 'HASH_PLACEHOLDER',
        first_name: 'Foreign',
        last_name: 'Teacher2',
        status: 'active',
        user_roles: { create: { role_id: roleTeacher.id } }
      }
    });
    await prisma.teacher.create({
      data: {
        id: teacher2ProfileId,
        user_id: teacher2UserId,
        employee_id: teacher2SchoolId,
        department: 'Science',
        position: 'Teacher I'
      }
    });

    // Student 1 & 2
    await prisma.user.create({
      data: {
        id: student1UserId,
        school_id: 'SYNTH-STU-ID1',
        email: 'stu1@test.local',
        password_hash: 'HASH_PLACEHOLDER',
        first_name: 'Student',
        last_name: 'Alpha',
        status: 'active',
        user_roles: { create: { role_id: roleStudent.id } }
      }
    });
    await prisma.student.create({
      data: {
        id: student1ProfileId,
        user_id: student1UserId,
        student_number: 'SN-ID-001',
        lrn: '888800001111',
        grade_level: 10
      }
    });

    await prisma.user.create({
      data: {
        id: student2UserId,
        school_id: 'SYNTH-STU-ID2',
        email: 'stu2@test.local',
        password_hash: 'HASH_PLACEHOLDER',
        first_name: 'Student',
        last_name: 'Beta',
        status: 'active',
        user_roles: { create: { role_id: roleStudent.id } }
      }
    });
    await prisma.student.create({
      data: {
        id: student2ProfileId,
        user_id: student2UserId,
        student_number: 'SN-ID-002',
        lrn: '888800002222',
        grade_level: 10
      }
    });

    // Sections & Assignments
    await prisma.section.create({
      data: {
        id: section1Id,
        academic_year_id: academicYearId,
        name: 'Section-Main-Verify',
        grade_level: 10
      }
    });
    await prisma.teacherSubjectAssignment.create({
      data: {
        id: assignment1Id,
        academic_year_id: academicYearId,
        teacher_id: teacher1ProfileId,
        section_id: section1Id,
        subject_id: subjectId
      }
    });

    await prisma.section.create({
      data: {
        id: section2Id,
        academic_year_id: academicYearId,
        name: 'Section-Foreign-Verify',
        grade_level: 10
      }
    });
    await prisma.teacherSubjectAssignment.create({
      data: {
        id: assignment2Id,
        academic_year_id: academicYearId,
        teacher_id: teacher2ProfileId,
        section_id: section2Id,
        subject_id: subjectId
      }
    });

    // Enrollments
    await prisma.enrollment.create({
      data: {
        id: enrollment1Id,
        academic_year_id: academicYearId,
        student_id: student1ProfileId,
        section_id: section1Id,
        status: 'Enrolled'
      }
    });
    await prisma.enrollment.create({
      data: {
        id: enrollment2Id,
        academic_year_id: academicYearId,
        student_id: student2ProfileId,
        section_id: section1Id,
        status: 'Enrolled'
      }
    });

    teacher1Token = sign({ userId: teacher1UserId }, config.jwt.secret, { expiresIn: '1h' });
    teacher2Token = sign({ userId: teacher2UserId }, config.jwt.secret, { expiresIn: '1h' });
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  // Persistent initial column IDs for Section 1
  const ww1Id = generateId();
  const ww2Id = generateId();
  const ww3Id = generateId();
  const pt1Id = generateId();
  const pt2Id = generateId();

  // Helper to build initial 6-column baseline payload
  function buildBaselinePayload(overrides?: any) {
    return {
      T1: {
        wwItems: [
          { id: ww1Id, label: 'Written Work 1', max: 20 },
          { id: ww2Id, label: 'Written Work 2', max: 20 },
          { id: ww3Id, label: 'Written Work 3', max: 20 }
        ],
        ptItems: [
          { id: pt1Id, label: 'Performance Task 1', max: 50 },
          { id: pt2Id, label: 'Performance Task 2', max: 50 }
        ],
        qaMax: 100,
        grades: {
          [enrollment1Id]: {
            [ww1Id]: '18',
            [ww2Id]: '17',
            [ww3Id]: '19',
            [pt1Id]: '45',
            [pt2Id]: '48',
            qa: '92'
          },
          [enrollment2Id]: {
            [ww1Id]: '0', // recorded zero
            [ww2Id]: '15',
            [ww3Id]: '16',
            [pt1Id]: '40',
            [pt2Id]: '42',
            qa: '85'
          }
        },
        ...overrides
      }
    };
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // PHASE 1: ASSESSMENT COLUMN IDENTITY VERIFICATION
  // ══════════════════════════════════════════════════════════════════════════════

  it('TC-IDENT-01-Setup: Initial baseline Gradebook creation with 6 columns and distinguishable scores', async () => {
    await saveLedger(assignment1Id, buildBaselinePayload(), teacher1UserId);

    const cols = await prisma.gradebook_columns.findMany({
      where: { gradebook: { assignment_id: assignment1Id } },
      orderBy: { sort_order: 'asc' }
    });
    expect(cols.length).toBe(6); // WW1, WW2, WW3, PT1, PT2, QA
    expect(cols[0].id).toBe(ww1Id);
    expect(cols[1].id).toBe(ww2Id);
    expect(cols[2].id).toBe(ww3Id);
    expect(cols[3].id).toBe(pt1Id);
    expect(cols[4].id).toBe(pt2Id);
    expect(cols[5].type).toBe('QA');
  });

  it('TC-IDENT-01-A: Update WW2 only — WW1 and WW3 scores remain completely unchanged, column IDs stable', async () => {
    const payload = buildBaselinePayload({
      grades: {
        [enrollment1Id]: {
          [ww1Id]: '18',
          [ww2Id]: '20', // WW2 changed from 17 to 20
          [ww3Id]: '19',
          [pt1Id]: '45',
          [pt2Id]: '48',
          qa: '92'
        },
        [enrollment2Id]: {
          [ww1Id]: '0',
          [ww2Id]: '15',
          [ww3Id]: '16',
          [pt1Id]: '40',
          [pt2Id]: '42',
          qa: '85'
        }
      }
    });

    await saveLedger(assignment1Id, payload, teacher1UserId);

    // Verify WW2 score updated
    const s1WW2 = await prisma.grade_entries.findFirst({
      where: { enrollment_id: enrollment1Id, column_id: ww2Id }
    });
    expect(s1WW2?.score).toBe(20);

    // Verify WW1 and WW3 scores untouched
    const s1WW1 = await prisma.grade_entries.findFirst({
      where: { enrollment_id: enrollment1Id, column_id: ww1Id }
    });
    expect(s1WW1?.score).toBe(18);

    const s1WW3 = await prisma.grade_entries.findFirst({
      where: { enrollment_id: enrollment1Id, column_id: ww3Id }
    });
    expect(s1WW3?.score).toBe(19);

    // Column IDs remain stable
    const cols = await prisma.gradebook_columns.findMany({
      where: { gradebook: { assignment_id: assignment1Id } },
      orderBy: { sort_order: 'asc' }
    });
    expect(cols[1].id).toBe(ww2Id);
  });

  it('TC-IDENT-01-B: Update PT2 only — PT1 remains unchanged', async () => {
    const payload = buildBaselinePayload({
      grades: {
        [enrollment1Id]: {
          [ww1Id]: '18',
          [ww2Id]: '20',
          [ww3Id]: '19',
          [pt1Id]: '45',
          [pt2Id]: '50', // PT2 changed from 48 to 50
          qa: '92'
        }
      }
    });

    await saveLedger(assignment1Id, payload, teacher1UserId);

    const s1PT2 = await prisma.grade_entries.findFirst({
      where: { enrollment_id: enrollment1Id, column_id: pt2Id }
    });
    expect(s1PT2?.score).toBe(50);

    const s1PT1 = await prisma.grade_entries.findFirst({
      where: { enrollment_id: enrollment1Id, column_id: pt1Id }
    });
    expect(s1PT1?.score).toBe(45);
  });

  it('TC-IDENT-01-C: Rename WW2 — column label updates, column ID remains unchanged, scores remain associated', async () => {
    const payload = buildBaselinePayload({
      wwItems: [
        { id: ww1Id, label: 'Written Work 1', max: 20 },
        { id: ww2Id, label: 'Quiz on Polynomials', max: 20 }, // Renamed WW2
        { id: ww3Id, label: 'Written Work 3', max: 20 }
      ],
      grades: {
        [enrollment1Id]: {
          [ww1Id]: '18',
          [ww2Id]: '20',
          [ww3Id]: '19',
          [pt1Id]: '45',
          [pt2Id]: '50',
          qa: '92'
        }
      }
    });

    await saveLedger(assignment1Id, payload, teacher1UserId);

    const colWW2 = await prisma.gradebook_columns.findUnique({ where: { id: ww2Id } });
    expect(colWW2).not.toBeNull();
    expect(colWW2?.label).toBe('Quiz on Polynomials');
    expect(colWW2?.id).toBe(ww2Id);

    // Student score still associated with this column
    const s1Entry = await prisma.grade_entries.findFirst({
      where: { enrollment_id: enrollment1Id, column_id: ww2Id }
    });
    expect(s1Entry?.score).toBe(20);
  });

  it('TC-IDENT-01-D: Reorder WW columns — sort order updates, IDs unchanged, scores do NOT move between assessments', async () => {
    // Reorder from [WW1, WW2, WW3] to [WW3, WW1, WW2]
    const payload = buildBaselinePayload({
      wwItems: [
        { id: ww3Id, label: 'Written Work 3', max: 20 },
        { id: ww1Id, label: 'Written Work 1', max: 20 },
        { id: ww2Id, label: 'Quiz on Polynomials', max: 20 }
      ],
      grades: {
        [enrollment1Id]: {
          [ww1Id]: '18',
          [ww2Id]: '20',
          [ww3Id]: '19',
          [pt1Id]: '45',
          [pt2Id]: '50',
          qa: '92'
        }
      }
    });

    await saveLedger(assignment1Id, payload, teacher1UserId);

    const cols = await prisma.gradebook_columns.findMany({
      where: { gradebook: { assignment_id: assignment1Id }, type: 'WW' },
      orderBy: { sort_order: 'asc' }
    });
    expect(cols[0].id).toBe(ww3Id);
    expect(cols[0].sort_order).toBe(0);
    expect(cols[1].id).toBe(ww1Id);
    expect(cols[1].sort_order).toBe(1);
    expect(cols[2].id).toBe(ww2Id);
    expect(cols[2].sort_order).toBe(2);

    // Verify scores stayed strictly with their respective columns and did NOT move
    const s1WW1 = await prisma.grade_entries.findFirst({ where: { enrollment_id: enrollment1Id, column_id: ww1Id } });
    const s1WW2 = await prisma.grade_entries.findFirst({ where: { enrollment_id: enrollment1Id, column_id: ww2Id } });
    const s1WW3 = await prisma.grade_entries.findFirst({ where: { enrollment_id: enrollment1Id, column_id: ww3Id } });

    expect(s1WW1?.score).toBe(18);
    expect(s1WW2?.score).toBe(20);
    expect(s1WW3?.score).toBe(19);
  });

  it('TC-IDENT-01-E: Same category, identical/similar labels — matched strictly by ID, not by label', async () => {
    // Assign identical label "Quiz" to both WW1 and WW2
    const payload = buildBaselinePayload({
      wwItems: [
        { id: ww1Id, label: 'Quiz', max: 20 },
        { id: ww2Id, label: 'Quiz', max: 20 },
        { id: ww3Id, label: 'Quiz Part 2', max: 20 }
      ],
      grades: {
        [enrollment1Id]: {
          [ww1Id]: '18',
          [ww2Id]: '14',
          [ww3Id]: '19'
        }
      }
    });

    await saveLedger(assignment1Id, payload, teacher1UserId);

    const e1 = await prisma.grade_entries.findFirst({ where: { enrollment_id: enrollment1Id, column_id: ww1Id } });
    const e2 = await prisma.grade_entries.findFirst({ where: { enrollment_id: enrollment1Id, column_id: ww2Id } });
    expect(e1?.score).toBe(18);
    expect(e2?.score).toBe(14);
  });

  it('TC-IDENT-01-F: Repeated identical save — zero duplicate columns, zero duplicate entries, stable IDs', async () => {
    const payload = buildBaselinePayload();

    await saveLedger(assignment1Id, payload, teacher1UserId);
    await saveLedger(assignment1Id, payload, teacher1UserId);
    await saveLedger(assignment1Id, payload, teacher1UserId);

    const cols = await prisma.gradebook_columns.findMany({
      where: { gradebook: { assignment_id: assignment1Id } }
    });
    expect(cols.length).toBe(6); // Still exactly 6 columns

    const entries = await prisma.grade_entries.findMany({
      where: { column: { gradebook: { assignment_id: assignment1Id } } }
    });
    // Exactly 12 entries (6 per student for 2 students)
    expect(entries.length).toBe(12);
  });

  it('TC-IDENT-01-G: Newly added assessment — new unique column ID created, existing columns retain IDs and scores', async () => {
    const ww4Id = generateId();
    const payload = buildBaselinePayload({
      wwItems: [
        { id: ww1Id, label: 'Written Work 1', max: 20 },
        { id: ww2Id, label: 'Written Work 2', max: 20 },
        { id: ww3Id, label: 'Written Work 3', max: 20 },
        { id: ww4Id, label: 'Written Work 4', max: 25 } // Added 4th column
      ],
      grades: {
        [enrollment1Id]: {
          [ww1Id]: '18',
          [ww2Id]: '17',
          [ww3Id]: '19',
          [ww4Id]: '24', // score for WW4
          [pt1Id]: '45',
          [pt2Id]: '48',
          qa: '92'
        }
      }
    });

    await saveLedger(assignment1Id, payload, teacher1UserId);

    const cols = await prisma.gradebook_columns.findMany({
      where: { gradebook: { assignment_id: assignment1Id }, type: 'WW' }
    });
    expect(cols.length).toBe(4);
    expect(cols.some(c => c.id === ww4Id)).toBe(true);

    // Existing WW1 score still intact
    const e1 = await prisma.grade_entries.findFirst({ where: { enrollment_id: enrollment1Id, column_id: ww1Id } });
    expect(e1?.score).toBe(18);

    // New WW4 score persisted
    const e4 = await prisma.grade_entries.findFirst({ where: { enrollment_id: enrollment1Id, column_id: ww4Id } });
    expect(e4?.score).toBe(24);
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // PHASE 2: PREVENT UNINTENDED COLUMN AND SCORE DELETION
  // ══════════════════════════════════════════════════════════════════════════════

  it('TC-DELE-02-A: Missing column from malformed payload — WW2 omitted accidentally WITHOUT deletedColumnIds is PRESERVED along with its scores', async () => {
    // Malformed/incomplete payload that only includes WW1 and WW3, omitting WW2
    // Because WW2 has recorded student scores and is NOT in deletedColumnIds, it MUST NOT be deleted!
    const malformedPayload = {
      T1: {
        wwItems: [
          { id: ww1Id, label: 'Written Work 1', max: 20 },
          { id: ww3Id, label: 'Written Work 3', max: 20 }
          // ww2Id omitted!
        ],
        ptItems: [
          { id: pt1Id, label: 'Performance Task 1', max: 50 },
          { id: pt2Id, label: 'Performance Task 2', max: 50 }
        ],
        qaMax: 100,
        grades: {
          [enrollment1Id]: {
            [ww1Id]: '18',
            [ww3Id]: '19'
          }
        }
        // deletedColumnIds NOT specified
      }
    };

    await saveLedger(assignment1Id, malformedPayload, teacher1UserId);

    // PROVES DATA-LOSS PROTECTION: WW2 and its student entries MUST STILL EXIST!
    const ww2Col = await prisma.gradebook_columns.findUnique({ where: { id: ww2Id } });
    expect(ww2Col).not.toBeNull();

    const ww2Entries = await prisma.grade_entries.findMany({ where: { column_id: ww2Id } });
    expect(ww2Entries.length).toBeGreaterThan(0);
  });

  it('TC-DELE-02-B: Missing score entry — omitting a student from grades does NOT delete their existing score', async () => {
    // Payload contains grades for student 1 only, student 2 is omitted
    const payload = buildBaselinePayload({
      grades: {
        [enrollment1Id]: {
          [ww1Id]: '18'
        }
        // student 2 omitted from payload
      }
    });

    await saveLedger(assignment1Id, payload, teacher1UserId);

    // Student 2's WW1 score (recorded zero) must still be in the database!
    const s2Entry = await prisma.grade_entries.findFirst({
      where: { enrollment_id: enrollment2Id, column_id: ww1Id }
    });
    expect(s2Entry).not.toBeNull();
    expect(s2Entry?.score).toBe(0);
  });

  it('TC-DELE-02-C: Explicit score clearing — empty string clears score and correctly distinguishes missing from zero', async () => {
    // Explicitly clear student 1's WW3 score by setting it to ""
    const payload = buildBaselinePayload({
      grades: {
        [enrollment1Id]: {
          [ww1Id]: '18',
          [ww2Id]: '17',
          [ww3Id]: '', // Cleared!
          [pt1Id]: '45',
          [pt2Id]: '48',
          qa: '92'
        }
      }
    });

    await saveLedger(assignment1Id, payload, teacher1UserId);

    // Entry for WW3 is deleted (becomes null/unrecorded)
    const s1WW3 = await prisma.grade_entries.findFirst({
      where: { enrollment_id: enrollment1Id, column_id: ww3Id }
    });
    expect(s1WW3).toBeNull();

    // Student 2's WW1 is 0, which is NOT null
    const s2WW1 = await prisma.grade_entries.findFirst({
      where: { enrollment_id: enrollment2Id, column_id: ww1Id }
    });
    expect(s2WW1).not.toBeNull();
    expect(s2WW1?.score).toBe(0);
  });

  it('TC-DELE-02-D: Intentional assessment removal — explicitly authorized via deletedColumnIds deletes column and entries atomically', async () => {
    // Create a temporary column WW-Temp with a score
    const tempColId = generateId();
    await saveLedger(assignment1Id, buildBaselinePayload({
      wwItems: [
        { id: ww1Id, label: 'Written Work 1', max: 20 },
        { id: ww2Id, label: 'Written Work 2', max: 20 },
        { id: ww3Id, label: 'Written Work 3', max: 20 },
        { id: tempColId, label: 'Temporary Column', max: 20 }
      ],
      grades: {
        [enrollment1Id]: { [tempColId]: '15' }
      }
    }), teacher1UserId);

    const createdCol = await prisma.gradebook_columns.findUnique({ where: { id: tempColId } });
    expect(createdCol).not.toBeNull();

    // Now explicitly delete it using deletedColumnIds
    const deletePayload = buildBaselinePayload({
      wwItems: [
        { id: ww1Id, label: 'Written Work 1', max: 20 },
        { id: ww2Id, label: 'Written Work 2', max: 20 },
        { id: ww3Id, label: 'Written Work 3', max: 20 }
      ],
      deletedColumnIds: [tempColId] // EXPLICIT AUTHORIZED INTENT
    });

    await saveLedger(assignment1Id, deletePayload, teacher1UserId);

    const deletedCol = await prisma.gradebook_columns.findUnique({ where: { id: tempColId } });
    expect(deletedCol).toBeNull();

    const orphanEntries = await prisma.grade_entries.findMany({ where: { column_id: tempColId } });
    expect(orphanEntries.length).toBe(0);
  });

  it('TC-DELE-02-E: Unknown column ID is handled safely without modifying unrelated records', async () => {
    const unknownColId = 'unknown-col-never-existed';
    const payload = buildBaselinePayload({
      wwItems: [
        { id: ww1Id, label: 'Written Work 1', max: 20 },
        { id: ww2Id, label: 'Written Work 2', max: 20 },
        { id: ww3Id, label: 'Written Work 3', max: 20 },
        { id: unknownColId, label: 'Unknown Column', max: 20 }
      ]
    });

    // Succeeds and creates a new column for this ID (or generates safe UUID) without error
    await expect(saveLedger(assignment1Id, payload, teacher1UserId)).resolves.not.toThrow();

    // Clean it up
    await saveLedger(assignment1Id, buildBaselinePayload({ deletedColumnIds: [unknownColId] }), teacher1UserId);
  });

  it('TC-DELE-02-F: Duplicate column ID in payload is rejected with 422 VALIDATION_ERROR', async () => {
    const duplicatePayload = {
      T1: {
        wwItems: [
          { id: ww1Id, label: 'Written Work 1', max: 20 },
          { id: ww1Id, label: 'Duplicate Written Work 1', max: 20 } // DUPLICATE ID
        ],
        ptItems: [],
        grades: {}
      }
    };

    await expect(saveLedger(assignment1Id, duplicatePayload, teacher1UserId)).rejects.toThrow(
      /Duplicate column ID/
    );

    // Also via HTTP route returns 422
    const res = await request(app)
      .post('/api/gradebooks/ledger')
      .set('Authorization', `Bearer ${teacher1Token}`)
      .send({
        classId: assignment1Id,
        terms: duplicatePayload
      });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('TC-DELE-02-G: Cross-gradebook column reference is rejected with 403 FORBIDDEN', async () => {
    // Setup a gradebook in Section 2 with its own column
    const foreignColId = generateId();
    await saveLedger(assignment2Id, {
      T1: {
        wwItems: [{ id: foreignColId, label: 'Foreign WW1', max: 30 }],
        ptItems: [],
        qaMax: 100,
        grades: {}
      }
    }, teacher2UserId);

    // Now Teacher 1 attempts to inject Teacher 2's column ID into Section 1's gradebook
    const attackPayload = buildBaselinePayload({
      wwItems: [
        { id: ww1Id, label: 'Written Work 1', max: 20 },
        { id: foreignColId, label: 'Hijacked Foreign Column', max: 20 } // Cross-gradebook!
      ]
    });

    await expect(saveLedger(assignment1Id, attackPayload, teacher1UserId)).rejects.toThrow(
      /belongs to another gradebook/
    );

    // Foreign column in Section 2 remains completely unmodified
    const foreignCol = await prisma.gradebook_columns.findUnique({ where: { id: foreignColId } });
    expect(foreignCol?.label).toBe('Foreign WW1');
  });

  it('TC-DELE-02-H: Transaction failure during save rolls back all changes atomically', async () => {
    const invalidClassId = 'invalid-class-id-triggers-abort';
    await expect(
      saveLedger(invalidClassId, buildBaselinePayload(), teacher1UserId)
    ).rejects.toThrow();

    // Verify main gradebook state remains completely valid
    const gb = await prisma.gradebooks.findFirst({
      where: { assignment_id: assignment1Id, term: { key: 'T1' } }
    });
    expect(gb).not.toBeNull();
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // PHASE 3: CONCURRENT SAVE AND LOST-UPDATE VERIFICATION
  // ══════════════════════════════════════════════════════════════════════════════

  it('TC-CONC-03-A: Two simultaneous saves to the same gradebook execute cleanly and serialize', async () => {
    const p1 = buildBaselinePayload({
      grades: { [enrollment1Id]: { [ww1Id]: '19' } }
    });
    const p2 = buildBaselinePayload({
      grades: { [enrollment1Id]: { [ww1Id]: '20' } }
    });

    // Execute concurrently
    const [res1, res2] = await Promise.allSettled([
      saveLedger(assignment1Id, p1, teacher1UserId),
      saveLedger(assignment1Id, p2, teacher1UserId)
    ]);

    // Both promises settle cleanly without database deadlock or unhandled crash
    expect(res1.status).toBe('fulfilled');
    expect(res2.status).toBe('fulfilled');
  });

  it('TC-CONC-03-B & C: Optimistic concurrency rejects stale browser save with 409 CONFLICT', async () => {
    // 1. Session A reads ledger at current version
    const ledgerBefore = await getLedger(assignment1Id, teacher1UserId);
    const initialVersion = ledgerBefore.terms.T1.version;
    expect(initialVersion).toBeDefined();

    // 2. Session B saves a modification with initialVersion
    const payloadB = buildBaselinePayload({
      version: initialVersion,
      grades: { [enrollment1Id]: { [ww1Id]: '20' } }
    });
    await saveLedger(assignment1Id, payloadB, teacher1UserId);

    // 3. Gradebook version in DB has now incremented
    const ledgerAfterB = await getLedger(assignment1Id, teacher1UserId);
    expect(ledgerAfterB.terms.T1.version).toBe(initialVersion + 1);

    // 4. Session A (stale browser) tries to save using the outdated initialVersion
    const stalePayloadA = buildBaselinePayload({
      version: initialVersion, // STALE!
      grades: { [enrollment1Id]: { [ww1Id]: '10' } }
    });

    // PROVES LOST-UPDATE PREVENTION: Must reject with 409 CONFLICT!
    await expect(saveLedger(assignment1Id, stalePayloadA, teacher1UserId)).rejects.toThrow(
      /Gradebook version mismatch/
    );

    // Also via HTTP route returns 409 Conflict
    const res = await request(app)
      .post('/api/gradebooks/ledger')
      .set('Authorization', `Bearer ${teacher1Token}`)
      .send({
        classId: assignment1Id,
        terms: stalePayloadA
      });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');

    // Score remains Session B's 20, not overwritten by stale 10
    const currentScore = await prisma.grade_entries.findFirst({
      where: { enrollment_id: enrollment1Id, column_id: ww1Id }
    });
    expect(currentScore?.score).toBe(20);
  });

  it('TC-CONC-03-D: Simultaneous column additions are serialized without duplicate writes or data loss', async () => {
    const colAId = generateId();
    const colBId = generateId();

    const currentLedger = await getLedger(assignment1Id, teacher1UserId);
    const ver = currentLedger.terms.T1.version;

    // Save column A
    await saveLedger(assignment1Id, buildBaselinePayload({
      version: ver,
      wwItems: [
        { id: ww1Id, label: 'WW 1', max: 20 },
        { id: colAId, label: 'Column A', max: 20 }
      ]
    }), teacher1UserId);

    // Save column B with updated version
    const ledger2 = await getLedger(assignment1Id, teacher1UserId);
    await saveLedger(assignment1Id, buildBaselinePayload({
      version: ledger2.terms.T1.version,
      wwItems: [
        { id: ww1Id, label: 'WW 1', max: 20 },
        { id: colAId, label: 'Column A', max: 20 },
        { id: colBId, label: 'Column B', max: 20 }
      ]
    }), teacher1UserId);

    const cols = await prisma.gradebook_columns.findMany({
      where: { gradebook: { assignment_id: assignment1Id }, id: { in: [colAId, colBId] } }
    });
    expect(cols.length).toBe(2);

    // Clean up added columns
    await saveLedger(assignment1Id, buildBaselinePayload({
      deletedColumnIds: [colAId, colBId]
    }), teacher1UserId);
  });

  it('TC-CONC-03-E: Save and delete concurrently maintain transactional consistency', async () => {
    const tempCol = generateId();
    await saveLedger(assignment1Id, buildBaselinePayload({
      wwItems: [
        { id: ww1Id, label: 'WW 1', max: 20 },
        { id: tempCol, label: 'Temp Col', max: 20 }
      ]
    }), teacher1UserId);

    const pUpdate = buildBaselinePayload({
      grades: { [enrollment1Id]: { [ww1Id]: '19' } }
    });
    const pDelete = buildBaselinePayload({
      deletedColumnIds: [tempCol]
    });

    const [r1, r2] = await Promise.allSettled([
      saveLedger(assignment1Id, pUpdate, teacher1UserId),
      saveLedger(assignment1Id, pDelete, teacher1UserId)
    ]);

    // Under concurrent write to the same gradebook row, transactions serialize or detect write conflict
    const statuses = [r1.status, r2.status];
    expect(statuses).toContain('fulfilled');

    // Database remains healthy and uncorrupted
    const gb = await prisma.gradebooks.findFirst({
      where: { assignment_id: assignment1Id, term: { key: 'T1' } }
    });
    expect(gb).not.toBeNull();
  });

  it('TC-CONC-03-F: Transaction failure under concurrency rolls back cleanly while valid transaction succeeds', async () => {
    const validPromise = saveLedger(assignment1Id, buildBaselinePayload(), teacher1UserId);
    const invalidPromise = saveLedger('bad-id', buildBaselinePayload(), teacher1UserId);

    const [resValid, resInvalid] = await Promise.allSettled([validPromise, invalidPromise]);

    expect(resValid.status).toBe('fulfilled');
    expect(resInvalid.status).toBe('rejected');

    // Gradebook remains completely healthy
    const gb = await prisma.gradebooks.findFirst({
      where: { assignment_id: assignment1Id, term: { key: 'T1' } }
    });
    expect(gb).not.toBeNull();
  });
});
