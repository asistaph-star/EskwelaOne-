import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prisma from '../src/config/database.js';
import { saveLedger } from '../src/gradebooks/ledger.service.js';
import { getReportCardData } from '../src/academic/reportCard.service.js';
import {
  resolveStudentSf9DataMapping,
  generateStudentCalulutSf9,
} from '../src/academic/grading/calulutSf9Service.js';
import { classAttendanceService } from '../src/modules/class-attendance/classAttendance.service.js';
import { AuthenticatedUser } from '../src/common/middleware/auth.js';

describe('DIGISKWELA — Calulut SF9 Phase C: Automatic Grade & Attendance Data Integration (digiskwela_test)', () => {
  const synthAyId = 'synth-ay-sf9-phasec';
  const synthTermT1Id = 'synth-term-sf9-phasec-t1';
  const synthTermT2Id = 'synth-term-sf9-phasec-t2';
  const synthTermT3Id = 'synth-term-sf9-phasec-t3';

  const synthSectionId = 'synth-sec-sf9-phasec-7agoncillo';
  const synthOtherSectionId = 'synth-sec-sf9-phasec-7other';

  const synthTeacherUserId = 'synth-u-sf9-phasec-teacher1';
  const synthTeacherProfileId = 'synth-t-sf9-phasec-teacher1';
  const synthOtherTeacherUserId = 'synth-u-sf9-phasec-teacher2';
  const synthOtherTeacherProfileId = 'synth-t-sf9-phasec-teacher2';

  const synthStudentAUserId = 'synth-u-sf9-phasec-student-a';
  const synthStudentAProfileId = 'synth-s-sf9-phasec-student-a';
  const synthEnrollmentAId = 'synth-enr-sf9-phasec-student-a';

  const synthStudentBUserId = 'synth-u-sf9-phasec-student-b';
  const synthStudentBProfileId = 'synth-s-sf9-phasec-student-b';
  const synthEnrollmentBId = 'synth-enr-sf9-phasec-student-b';

  const synthMathSubjId = 'synth-subj-sf9-phasec-math7';
  const synthMusicSubjId = 'synth-subj-sf9-phasec-music7';
  const synthPeSubjId = 'synth-subj-sf9-phasec-pe7';

  const synthMathAssignId = 'synth-asgn-sf9-phasec-math7';
  const synthMusicAssignId = 'synth-asgn-sf9-phasec-music7';
  const synthPeAssignId = 'synth-asgn-sf9-phasec-pe7';
  const synthOtherAssignId = 'synth-asgn-sf9-phasec-other';

  const teacherActor: AuthenticatedUser = {
    id: synthTeacherUserId,
    roles: ['Teacher'],
    email: 'sf9_phasec_t1@test.local',
  };

  const otherTeacherActor: AuthenticatedUser = {
    id: synthOtherTeacherUserId,
    roles: ['Teacher'],
    email: 'sf9_phasec_t2@test.local',
  };

  const studentActor: AuthenticatedUser = {
    id: synthStudentAUserId,
    roles: ['Student'],
    email: 'sf9_phasec_stua@test.local',
  };

  const assignIds = [
    synthMathAssignId,
    synthMusicAssignId,
    synthPeAssignId,
    synthOtherAssignId,
  ];
  const enrollIds = [synthEnrollmentAId, synthEnrollmentBId];
  const studentIds = [synthStudentAProfileId, synthStudentBProfileId];
  const teacherIds = [synthTeacherProfileId, synthOtherTeacherProfileId];
  const userIds = [
    synthTeacherUserId,
    synthOtherTeacherUserId,
    synthStudentAUserId,
    synthStudentBUserId,
  ];
  const subjectIds = [synthMathSubjId, synthMusicSubjId, synthPeSubjId];

  async function cleanup() {
    await prisma.classAttendance.deleteMany({
      where: { assignment_id: { in: assignIds } },
    });
    await prisma.grade_entries.deleteMany({
      where: { enrollment_id: { in: enrollIds } },
    });
    await prisma.gradebook_columns.deleteMany({
      where: { gradebook: { assignment_id: { in: assignIds } } },
    });
    await prisma.gradebooks.deleteMany({
      where: { assignment_id: { in: assignIds } },
    });
    await prisma.grade.deleteMany({
      where: { student_id: { in: studentIds } },
    });
    await prisma.enrollment.deleteMany({
      where: { id: { in: enrollIds } },
    });
    await prisma.teacherSubjectAssignment.deleteMany({
      where: { id: { in: assignIds } },
    });
    await prisma.student.deleteMany({
      where: { id: { in: studentIds } },
    });
    await prisma.section.deleteMany({
      where: { id: { in: [synthSectionId, synthOtherSectionId] } },
    });
    await prisma.subject.deleteMany({
      where: { id: { in: subjectIds } },
    });
    await prisma.term.deleteMany({
      where: { id: { in: [synthTermT1Id, synthTermT2Id, synthTermT3Id] } },
    });
    await prisma.academicYear.deleteMany({
      where: { id: synthAyId },
    });
    await prisma.teacher.deleteMany({
      where: { id: { in: teacherIds } },
    });
    await prisma.auditLog.deleteMany({
      where: { actor_user_id: { in: userIds } },
    });
    await prisma.userRole.deleteMany({
      where: { user_id: { in: userIds } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: userIds } },
    });
  }

  beforeAll(async () => {
    // Strict Test Database Isolation Check
    expect(process.env.NODE_ENV).toBe('test');
    expect(process.env.DATABASE_URL).toContain('digiskwela_test');
    expect(process.env.DATABASE_URL).not.toMatch(/\/digiskwela(\?|$)/);

    await cleanup();

    let roleTeacher = await prisma.role.findUnique({ where: { name: 'Teacher' } });
    if (!roleTeacher) {
      roleTeacher = await prisma.role.create({ data: { name: 'Teacher' } });
    }
    let roleStudent = await prisma.role.findUnique({ where: { name: 'Student' } });
    if (!roleStudent) {
      roleStudent = await prisma.role.create({ data: { name: 'Student' } });
    }

    // 1. Create Synthetic Academic Year & 3 Terms (T1, T2, T3)
    await prisma.academicYear.create({
      data: {
        id: synthAyId,
        name: 'SY 2026-2027 (PhaseC-Test)',
        start_date: new Date('2026-06-01T00:00:00.000Z'),
        end_date: new Date('2027-04-30T00:00:00.000Z'),
        is_current: false,
      },
    });

    await prisma.term.createMany({
      data: [
        { id: synthTermT1Id, academic_year_id: synthAyId, name: 'Term 1', key: 'T1' },
        { id: synthTermT2Id, academic_year_id: synthAyId, name: 'Term 2', key: 'T2' },
        { id: synthTermT3Id, academic_year_id: synthAyId, name: 'Term 3', key: 'T3' },
      ],
    });

    // 2. Create Synthetic Subjects (Math, Music & Arts, PE & Health)
    await prisma.subject.createMany({
      data: [
        { id: synthMathSubjId, code: 'MATH7-PC', name: 'Mathematics 7' },
        { id: synthMusicSubjId, code: 'MUSIC7-PC', name: 'Music & Arts 7' },
        { id: synthPeSubjId, code: 'PE7-PC', name: 'Physical Education & Health 7' },
      ],
    });

    // 3. Create Synthetic Sections
    await prisma.section.createMany({
      data: [
        {
          id: synthSectionId,
          academic_year_id: synthAyId,
          name: 'Agoncillo-PhaseC',
          grade_level: 7,
        },
        {
          id: synthOtherSectionId,
          academic_year_id: synthAyId,
          name: 'Bonifacio-PhaseC',
          grade_level: 7,
        },
      ],
    });

    // 4. Create Synthetic Teachers
    await prisma.user.create({
      data: {
        id: synthTeacherUserId,
        school_id: 'SYNTH-PC-TCH1',
        email: 'sf9_phasec_t1@test.local',
        password_hash: 'HASH_PLACEHOLDER',
        first_name: 'Kathrina',
        last_name: 'Omlang',
        status: 'active',
        user_roles: { create: { role_id: roleTeacher.id } },
      },
    });
    await prisma.teacher.create({
      data: {
        id: synthTeacherProfileId,
        user_id: synthTeacherUserId,
        employee_id: 'EMP-PC-001',
        department: 'Mathematics',
        position: 'Teacher III',
      },
    });

    await prisma.user.create({
      data: {
        id: synthOtherTeacherUserId,
        school_id: 'SYNTH-PC-TCH2',
        email: 'sf9_phasec_t2@test.local',
        password_hash: 'HASH_PLACEHOLDER',
        first_name: 'Other',
        last_name: 'Teacher',
        status: 'active',
        user_roles: { create: { role_id: roleTeacher.id } },
      },
    });
    await prisma.teacher.create({
      data: {
        id: synthOtherTeacherProfileId,
        user_id: synthOtherTeacherUserId,
        employee_id: 'EMP-PC-002',
        department: 'Science',
        position: 'Teacher I',
      },
    });

    // 5. Create Synthetic Students A and B in the same section
    await prisma.user.create({
      data: {
        id: synthStudentAUserId,
        school_id: 'SYNTH-PC-STUA',
        email: 'sf9_phasec_stua@test.local',
        password_hash: 'HASH_PLACEHOLDER',
        first_name: 'Juan',
        middle_name: 'Santos',
        last_name: 'Dela Cruz',
        status: 'active',
        user_roles: { create: { role_id: roleStudent.id } },
      },
    });
    await prisma.student.create({
      data: {
        id: synthStudentAProfileId,
        user_id: synthStudentAUserId,
        student_number: 'SN-PC-A001',
        lrn: '999999260101',
        gender: 'Male',
        date_of_birth: new Date('2013-12-15T00:00:00.000Z'),
        grade_level: 7,
        current_section_id: synthSectionId,
      },
    });

    await prisma.user.create({
      data: {
        id: synthStudentBUserId,
        school_id: 'SYNTH-PC-STUB',
        email: 'sf9_phasec_stub@test.local',
        password_hash: 'HASH_PLACEHOLDER',
        first_name: 'Maria',
        middle_name: 'Reyes',
        last_name: 'Dela Cruz',
        status: 'active',
        user_roles: { create: { role_id: roleStudent.id } },
      },
    });
    await prisma.student.create({
      data: {
        id: synthStudentBProfileId,
        user_id: synthStudentBUserId,
        student_number: 'SN-PC-B002',
        lrn: '999999260102',
        gender: 'Female',
        date_of_birth: new Date('2014-03-20T00:00:00.000Z'),
        grade_level: 7,
        current_section_id: synthSectionId,
      },
    });

    // 6. Create TeacherSubjectAssignments & Enrollments
    await prisma.teacherSubjectAssignment.createMany({
      data: [
        {
          id: synthMathAssignId,
          academic_year_id: synthAyId,
          teacher_id: synthTeacherProfileId,
          section_id: synthSectionId,
          subject_id: synthMathSubjId,
        },
        {
          id: synthMusicAssignId,
          academic_year_id: synthAyId,
          teacher_id: synthTeacherProfileId,
          section_id: synthSectionId,
          subject_id: synthMusicSubjId,
        },
        {
          id: synthPeAssignId,
          academic_year_id: synthAyId,
          teacher_id: synthTeacherProfileId,
          section_id: synthSectionId,
          subject_id: synthPeSubjId,
        },
        {
          id: synthOtherAssignId,
          academic_year_id: synthAyId,
          teacher_id: synthOtherTeacherProfileId,
          section_id: synthOtherSectionId,
          subject_id: synthMathSubjId,
        },
      ],
    });

    await prisma.enrollment.createMany({
      data: [
        {
          id: synthEnrollmentAId,
          academic_year_id: synthAyId,
          student_id: synthStudentAProfileId,
          section_id: synthSectionId,
          status: 'Enrolled',
        },
        {
          id: synthEnrollmentBId,
          academic_year_id: synthAyId,
          student_id: synthStudentBProfileId,
          section_id: synthSectionId,
          status: 'Enrolled',
        },
      ],
    });
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it('Section 10 Required Grading Test (Steps 1–9): saves a Term 1 assessment via saveLedger, verifies calculated Grade, resolves SF9 mapping & cell coordinates, updates assessment on refresh, and isolates Student B', async () => {
    // Step 3: Save a Term 1 assessment for Student A in Mathematics 7 via real saveLedger()
    // Policy for Mathematics 7 (CORE): WW 25%, PT 50%, EX 25% (ST1 5%, ST2 5%, TE 15%)
    // WW: 85/100 -> PS = 85.00 -> WS = 21.25
    // PT: 90/100 -> PS = 90.00 -> WS = 45.00
    // ST1: 25/30 (83.33% * 5 = 4.17), ST2: 25/30 (83.33% * 5 = 4.17), TE: 45/50 (90% * 15 = 13.50) -> EX WS = 21.83
    // Initial Grade = 21.25 + 45.00 + 21.83 = 88.08 -> DO 015, s. 2026 Annex D Table 4 Transmuted = 90
    await saveLedger(
      synthMathAssignId,
      {
        T1: {
          wwItems: [{ id: 'col-ww1-pc', label: 'WW 1', max: 100 }],
          ptItems: [{ id: 'col-pt1-pc', label: 'PT 1', max: 100 }],
          st1Max: 30,
          st2Max: 30,
          teMax: 50,
          grades: {
            [synthEnrollmentAId]: {
              'col-ww1-pc': '85',
              'col-pt1-pc': '90',
              st1: '25',
              st2: '25',
              te: '45',
            },
          },
        },
      },
      synthTeacherUserId,
      'corr-phasec-step3'
    );

    // Step 4: Verify the calculated saved Grade record in digiskwela_test
    const savedGradeA = await prisma.grade.findFirst({
      where: {
        student_id: synthStudentAProfileId,
        subject_id: synthMathSubjId,
        term: 'T1',
        academic_year_id: synthAyId,
      },
    });
    expect(savedGradeA).not.toBeNull();
    expect(savedGradeA!.written_work).toBe(17);
    expect(savedGradeA!.performance_task).toBe(45);
    expect(savedGradeA!.term_assessment).toBe(25.8);
    expect(savedGradeA!.term_grade).toBe(90);

    // Verify gradebook status remains Draft (Save does NOT auto-publish)
    const mathGbT1 = await prisma.gradebooks.findFirst({
      where: {
        assignment_id: synthMathAssignId,
        term_id: synthTermT1Id,
      },
    });
    expect(mathGbT1).not.toBeNull();
    expect(mathGbT1!.status).toBe('Draft');

    // Step 5 & 6: Inspect the authorized SF9 data mapping & ReportCardDTO for Student A
    const mappingAfterFirstSave = await resolveStudentSf9DataMapping(
      synthStudentAProfileId,
      teacherActor
    );
    expect(mappingAfterFirstSave.student.id).toBe(synthStudentAProfileId);
    expect(mappingAfterFirstSave.student.lrn).toBe('999999260101');
    expect(mappingAfterFirstSave.enrollment.sectionId).toBe(synthSectionId);
    expect(mappingAfterFirstSave.enrollment.academicYearId).toBe(synthAyId);

    // Confirm Mathematics T1 is 90 and mapped to exact Calulut Excel cells
    expect(mappingAfterFirstSave.learningAreas.math.subjectId).toBe(synthMathSubjId);
    expect(mappingAfterFirstSave.learningAreas.math.T1).toBe(90);
    expect(mappingAfterFirstSave.learningAreas.math.T2).toBeNull();
    expect(mappingAfterFirstSave.learningAreas.math.T3).toBeNull();
    expect(mappingAfterFirstSave.learningAreas.math.finalGrade).toBeNull();
    expect(mappingAfterFirstSave.learningAreas.math.termPublicationStatus.T1).toBe('Draft');
    expect(mappingAfterFirstSave.learningAreas.math.cells.t1SummaryCell).toBe(
      "'TERM 1 SUMMARY'!M15"
    );
    expect(mappingAfterFirstSave.learningAreas.math.cells.sf9T1Cell).toBe(
      "'SF9 - GRADE 4-10'!F34"
    );

    // Confirm ReportCardDTO also reflects T1 = 90
    const reportCardDto1 = await getReportCardData(synthStudentAProfileId, synthTeacherUserId);
    const mathDto1 = reportCardDto1.scholastic.subjects.find((s) => s.id === synthMathSubjId);
    expect(mathDto1?.T1).toBe(90);
    expect(mathDto1?.T2).toBeNull();
    expect(mathDto1?.T3).toBeNull();
    expect(mathDto1?.finalRating).toBeNull();

    // Step 9 (Initial Check): Confirm Student B in the same section is completely unaffected
    const mappingStudentB = await resolveStudentSf9DataMapping(
      synthStudentBProfileId,
      teacherActor
    );
    expect(mappingStudentB.student.id).toBe(synthStudentBProfileId);
    expect(mappingStudentB.learningAreas.math.T1).toBeNull();
    expect(mappingStudentB.learningAreas.math.T2).toBeNull();
    expect(mappingStudentB.learningAreas.math.T3).toBeNull();

    // Step 7: Update Student A's Term 1 assessment via saveLedger()
    // WW: 96/100 -> WS = 24.00
    // PT: 96/100 -> WS = 48.00
    // ST1: 29/30 (4.83), ST2: 29/30 (4.83), TE: 48/50 (14.40) -> EX WS = 24.07
    // Initial Grade = 96.07 -> Transmuted Term Grade = 96
    await saveLedger(
      synthMathAssignId,
      {
        T1: {
          wwItems: [{ id: 'col-ww1-pc', label: 'WW 1', max: 100 }],
          ptItems: [{ id: 'col-pt1-pc', label: 'PT 1', max: 100 }],
          st1Max: 30,
          st2Max: 30,
          teMax: 50,
          grades: {
            [synthEnrollmentAId]: {
              'col-ww1-pc': '96',
              'col-pt1-pc': '96',
              st1: '27',
              st2: '27',
              te: '45',
            },
          },
        },
      },
      synthTeacherUserId,
      'corr-phasec-step7'
    );

    // Step 8: Confirm refresh immediately reflects the updated T1 grade (95) with no stale cached value
    const mappingAfterUpdate = await resolveStudentSf9DataMapping(
      synthStudentAProfileId,
      teacherActor
    );
    expect(mappingAfterUpdate.learningAreas.math.T1).toBe(95);
    expect(mappingAfterUpdate.learningAreas.math.T2).toBeNull();
    expect(mappingAfterUpdate.learningAreas.math.T3).toBeNull();

    const reportCardDto2 = await getReportCardData(synthStudentAProfileId, synthTeacherUserId);
    const mathDto2 = reportCardDto2.scholastic.subjects.find((s) => s.id === synthMathSubjId);
    expect(mathDto2?.T1).toBe(95);

    // Step 9 (Post-Update Check): Confirm Student B is still unaffected even though both share last name "Dela Cruz"
    const mappingStudentBAfterUpdate = await resolveStudentSf9DataMapping(
      synthStudentBProfileId,
      teacherActor
    );
    expect(mappingStudentBAfterUpdate.learningAreas.math.T1).toBeNull();
  });

  it('Verifies 3-term subject final grade, MAPEH composite calculation from Music & Arts + PE & Health, and General Average completeness gating', async () => {
    // Encode T2 and T3 for Mathematics, and T1-T3 for Music & Arts and PE & Health for Student A
    await saveLedger(
      synthMathAssignId,
      {
        T2: {
          wwItems: [{ id: 'col-ww-m-t2', label: 'WW 1', max: 100 }],
          ptItems: [{ id: 'col-pt-m-t2', label: 'PT 1', max: 100 }],
          st1Max: 30,
          st2Max: 30,
          teMax: 50,
          grades: {
            [synthEnrollmentAId]: {
              'col-ww-m-t2': '92',
              'col-pt-m-t2': '94',
              st1: '27',
              st2: '27',
              te: '45',
            },
          },
        },
        T3: {
          wwItems: [{ id: 'col-ww-m-t3', label: 'WW 1', max: 100 }],
          ptItems: [{ id: 'col-pt-m-t3', label: 'PT 1', max: 100 }],
          st1Max: 30,
          st2Max: 30,
          teMax: 50,
          grades: {
            [synthEnrollmentAId]: {
              'col-ww-m-t3': '94',
              'col-pt-m-t3': '95',
              st1: '27',
              st2: '27',
              te: '45',
            },
          },
        },
      },
      synthTeacherUserId,
      'corr-phasec-math-t2t3'
    );

    // Save Music & Arts (TECHNICAL: WW 20%, PT 60%, EX 20%) and PE & Health for T1
    await saveLedger(
      synthMusicAssignId,
      {
        T1: {
          wwItems: [{ id: 'col-ww-mus-t1', label: 'WW 1', max: 100 }],
          ptItems: [{ id: 'col-pt-mus-t1', label: 'PT 1', max: 100 }],
          st1Max: 30,
          st2Max: 30,
          teMax: 50,
          grades: {
            [synthEnrollmentAId]: {
              'col-ww-mus-t1': '90',
              'col-pt-mus-t1': '90',
              st1: '27',
              st2: '27',
              te: '45',
            },
          },
        },
      },
      synthTeacherUserId,
      'corr-phasec-mus-t1'
    );

    await saveLedger(
      synthPeAssignId,
      {
        T1: {
          wwItems: [{ id: 'col-ww-pe-t1', label: 'WW 1', max: 100 }],
          ptItems: [{ id: 'col-pt-pe-t1', label: 'PT 1', max: 100 }],
          st1Max: 30,
          st2Max: 30,
          teMax: 50,
          grades: {
            [synthEnrollmentAId]: {
              'col-ww-pe-t1': '85',
              'col-pt-pe-t1': '85',
              st1: '25',
              st2: '25',
              te: '42',
            },
          },
        },
      },
      synthTeacherUserId,
      'corr-phasec-pe-t1'
    );

    const mapping = await resolveStudentSf9DataMapping(synthStudentAProfileId, teacherActor);

    // Math has T1, T2, T3 -> finalGrade is computed as integer average of (T1 + T2 + T3) / 3
    expect(mapping.learningAreas.math.T1).toBe(95);
    expect(mapping.learningAreas.math.T2).not.toBeNull();
    expect(mapping.learningAreas.math.T3).not.toBeNull();
    const expectedMathFinal = Math.round(
      (mapping.learningAreas.math.T1! +
        mapping.learningAreas.math.T2! +
        mapping.learningAreas.math.T3!) /
        3
    );
    expect(mapping.learningAreas.math.finalGrade).toBe(expectedMathFinal);
    expect(mapping.learningAreas.math.remarks).toBe('Passed');

    // MAPEH T1 composite is integer average of Music T1 and PE T1
    expect(mapping.learningAreas.music.T1).not.toBeNull();
    expect(mapping.learningAreas.pe.T1).not.toBeNull();
    expect(mapping.mapehComposite.T1).toBe(
      Math.round((mapping.learningAreas.music.T1! + mapping.learningAreas.pe.T1!) / 2)
    );
    // MAPEH T2/T3 are null so MAPEH finalGrade is null
    expect(mapping.mapehComposite.finalGrade).toBeNull();

    // General Average must remain null because not all 8 main learning areas have 3-term final grades
    expect(mapping.generalAverage.value).toBeNull();
    expect(mapping.generalAverage.remarks).toBeNull();
  });

  it('Enforces RBAC, Teacher-to-Section boundaries, Grade Publication, and Non-Fabrication on official SF9 release', async () => {
    // 1. Student cannot access SF9 mapping or official SF9
    await expect(
      resolveStudentSf9DataMapping(synthStudentAProfileId, studentActor)
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'FORBIDDEN',
    });

    // 2. Teacher from another section cannot access Student A's SF9 mapping
    await expect(
      resolveStudentSf9DataMapping(synthStudentAProfileId, otherTeacherActor)
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'FORBIDDEN',
    });

    // 3. Assigned teacher is blocked from generating official SF9 while gradebooks are Draft
    await expect(
      generateStudentCalulutSf9(synthStudentAProfileId, teacherActor)
    ).rejects.toMatchObject({
      statusCode: 422,
      code: 'GRADES_NOT_PUBLISHED',
    });

    // 4. Verify non-fabrication of monthly attendance and adviser comments in mapping
    const mapping = await resolveStudentSf9DataMapping(synthStudentAProfileId, teacherActor);
    expect(mapping.attendance.isAuthoritativeSourceAvailable).toBe(false);
    expect(mapping.attendance.present).toBeNull();
    expect(mapping.attendance.classDays).toBeNull();
    expect(mapping.comments.isAuthoritativeSourceAvailable).toBe(false);
    expect(mapping.comments.t1).toBeNull();
    expect(mapping.comments.t2).toBeNull();
    expect(mapping.comments.t3).toBeNull();
    expect(mapping.releaseGate.isEligibleForOfficialRelease).toBe(false);
  });

  it('Section 10 Attendance Test: verifies ClassAttendance duplicate-day upsert protection and proves why per-subject attendance does not fabricate monthly SF9 attendance', async () => {
    // 1. Submit initial attendance for 2026-09-15 via classAttendanceService.bulkRecordClassAttendance
    const firstSubmit = await classAttendanceService.bulkRecordClassAttendance(
      synthMathAssignId,
      {
        records: [
          { studentEnrollmentId: synthEnrollmentAId, date: '2026-09-15', status: 'P' },
          { studentEnrollmentId: synthEnrollmentBId, date: '2026-09-15', status: 'A' },
        ],
      },
      synthTeacherUserId,
      { id: synthTeacherUserId, roles: ['Teacher'], permissions: [] },
      'corr-phasec-att-1'
    );
    expect(firstSubmit).toHaveLength(2);

    // 2. Submit updated attendance on the exact same date (2026-09-15) changing Student B from 'A' to 'L'
    const secondSubmit = await classAttendanceService.bulkRecordClassAttendance(
      synthMathAssignId,
      {
        records: [
          { studentEnrollmentId: synthEnrollmentAId, date: '2026-09-15', status: 'P' },
          {
            studentEnrollmentId: synthEnrollmentBId,
            date: '2026-09-15',
            status: 'L',
            remarks: 'Arrived 10 mins late',
          },
        ],
      },
      synthTeacherUserId,
      { id: synthTeacherUserId, roles: ['Teacher'], permissions: [] },
      'corr-phasec-att-2'
    );
    expect(secondSubmit).toHaveLength(2);

    // 3. Verify no duplicate rows were created for (assignment_id, enrollment_id, date)
    const rows = await prisma.classAttendance.findMany({
      where: {
        assignment_id: synthMathAssignId,
        date: new Date('2026-09-15T00:00:00.000Z'),
      },
    });
    expect(rows).toHaveLength(2);
    const rowA = rows.find((r) => r.enrollment_id === synthEnrollmentAId);
    const rowB = rows.find((r) => r.enrollment_id === synthEnrollmentBId);
    expect(rowA?.status).toBe('P');
    expect(rowB?.status).toBe('L');
    expect(rowB?.remarks).toBe('Arrived 10 mins late');

    // 4. Confirm SF9 mapping still does not fabricate monthly SF9 totals from single-subject ClassAttendance
    const mapping = await resolveStudentSf9DataMapping(synthStudentAProfileId, teacherActor);
    expect(mapping.attendance.isAuthoritativeSourceAvailable).toBe(false);
    expect(mapping.attendance.present).toBeNull();
    expect(mapping.attendance.classDays).toBeNull();
  });

  it('Phase D Verification: enforces MAPEH single-component completeness guard, separates Draft vs. Published term ratings, and integrates SchoolSettings metadata', async () => {
    // 1. Save Music & Arts T2 ONLY (leaving PE & Health T2 unencoded/null)
    await saveLedger(
      synthMusicAssignId,
      {
        T2: {
          wwItems: [{ id: 'col-ww-mus-t2', label: 'WW 1', max: 100 }],
          ptItems: [{ id: 'col-pt-mus-t2', label: 'PT 1', max: 100 }],
          st1Max: 30,
          st2Max: 30,
          teMax: 50,
          grades: {
            [synthEnrollmentAId]: {
              'col-ww-mus-t2': '92',
              'col-pt-mus-t2': '92',
              st1: '27',
              st2: '27',
              te: '45',
            },
          },
        },
      },
      synthTeacherUserId,
      'corr-phased-mus-t2'
    );

    const mappingWhileDraft = await resolveStudentSf9DataMapping(
      synthStudentAProfileId,
      teacherActor
    );

    // Verify MAPEH single-component guard: Music T2 is non-null, PE T2 is null -> mapehComposite.T2 MUST be null
    expect(mappingWhileDraft.learningAreas.music.T2).not.toBeNull();
    expect(mappingWhileDraft.learningAreas.pe.T2).toBeNull();
    expect(mappingWhileDraft.mapehComposite.T2).toBeNull();

    // Verify Draft vs. Published separation: Math has T1, T2, T3 saved in Draft gradebooks -> publishedT1/T2/T3 are null
    expect(mappingWhileDraft.learningAreas.math.T1).toBe(95);
    expect(mappingWhileDraft.learningAreas.math.finalGrade).not.toBeNull();
    expect(mappingWhileDraft.learningAreas.math.publishedT1).toBeNull();
    expect(mappingWhileDraft.learningAreas.math.publishedT2).toBeNull();
    expect(mappingWhileDraft.learningAreas.math.publishedT3).toBeNull();
    expect(mappingWhileDraft.learningAreas.math.publishedFinalGrade).toBeNull();
    expect(mappingWhileDraft.learningAreas.math.isSubjectPublishedAcrossThreeTerms).toBe(false);

    // Verify unassigned subject slots (e.g. Filipino) report 'Missing' publication status, not another subject's status
    expect(mappingWhileDraft.learningAreas.filipino.termPublicationStatus.T1).toBe('Missing');

    // 2. Publish ONLY Mathematics T1, T2, T3 gradebooks while Music & PE remain Draft
    await prisma.gradebooks.updateMany({
      where: { assignment_id: synthMathAssignId },
      data: { status: 'Published' },
    });

    const mappingPartialPub = await resolveStudentSf9DataMapping(
      synthStudentAProfileId,
      teacherActor
    );
    expect(mappingPartialPub.learningAreas.math.publishedT1).toBe(95);
    expect(mappingPartialPub.learningAreas.math.publishedFinalGrade).toBe(
      mappingPartialPub.learningAreas.math.finalGrade
    );
    expect(mappingPartialPub.learningAreas.math.isSubjectPublishedAcrossThreeTerms).toBe(true);
    expect(mappingPartialPub.publicationStatus.publishedThreeTermSubjects).toEqual(['math']);

    // Because Music & PE gradebooks are still Draft, section-wide publication gate remains false
    expect(mappingPartialPub.publicationStatus.allGradebooksPublished).toBe(false);
    expect(mappingPartialPub.publicationStatus.allAssignedSubjectsPublished).toBe(false);
    expect(mappingPartialPub.publicationStatus.hasImmutablePublishedSnapshot).toBe(false);

    // Official SF9 generation remains blocked by 422 GRADES_NOT_PUBLISHED
    await expect(
      generateStudentCalulutSf9(synthStudentAProfileId, teacherActor)
    ).rejects.toMatchObject({
      statusCode: 422,
      code: 'GRADES_NOT_PUBLISHED',
    });

    // 3. Verify SchoolSettings institutional metadata integration and explicit missing signatory/schoolId fields
    expect(mappingPartialPub.schoolMetadata.schoolName).toBe('Calulut Integrated School');
    expect(mappingPartialPub.schoolMetadata.schoolShortName).toBe('CIS');
    expect(mappingPartialPub.schoolMetadata.schoolId).toBeNull();
    expect(mappingPartialPub.schoolMetadata.region).toBeNull();
    expect(mappingPartialPub.schoolMetadata.division).toBeNull();
    expect(mappingPartialPub.signatories.adviser).toBeNull();
    expect(mappingPartialPub.signatories.schoolHead).toBeNull();
  });
});

