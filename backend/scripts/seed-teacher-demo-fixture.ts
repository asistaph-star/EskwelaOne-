import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const prisma = new PrismaClient();

// Hard-block execution in production
if (process.env.NODE_ENV === 'production') {
  console.error('FATAL: Running fixture scripts in production is strictly prohibited.');
  process.exit(1);
}

interface FixtureStudentDef {
  num: string;
  first: string;
  last: string;
  grade: number | null;
  att: 'present' | 'late' | 'absent';
  inTime?: string;
  wwScore: number | null; // out of 50
  ptScore: number | null; // out of 100
}

const FIXTURE_STUDENTS: FixtureStudentDef[] = [
  { num: '01', first: 'Angelo', last: 'Santos', grade: 88, att: 'present', inTime: '06:55', wwScore: 44, ptScore: 89 },
  { num: '02', first: 'Bea', last: 'Reyes', grade: 91, att: 'present', inTime: '07:05', wwScore: 47, ptScore: 92 },
  { num: '03', first: 'Carlo', last: 'Cruz', grade: 84, att: 'present', inTime: '07:12', wwScore: 41, ptScore: 85 },
  { num: '04', first: 'Danica', last: 'Bautista', grade: 77, att: 'present', inTime: '07:20', wwScore: 36, ptScore: 78 },
  { num: '05', first: 'Eduardo', last: 'Ocampo', grade: 82, att: 'present', inTime: '07:15', wwScore: 40, ptScore: 83 },
  { num: '06', first: 'Francis', last: 'Garcia', grade: 73, att: 'present', inTime: '06:50', wwScore: 0, ptScore: 74 }, // Legitimate 0 on WW1!
  { num: '07', first: 'Gabriel', last: 'Mendoza', grade: 86, att: 'present', inTime: '07:10', wwScore: 43, ptScore: 87 },
  { num: '08', first: 'Hannah', last: 'Torres', grade: 94, att: 'present', inTime: '06:45', wwScore: 49, ptScore: 95 }, // honors
  { num: '09', first: 'Ian', last: 'Ramos', grade: 80, att: 'late', inTime: '07:42', wwScore: 39, ptScore: 81 },       // late
  { num: '10', first: 'Jasmine', last: 'Flores', grade: 89, att: 'present', inTime: '07:08', wwScore: 45, ptScore: 90 },
  { num: '11', first: 'Kenneth', last: 'Gonzales', grade: 78, att: 'present', inTime: '07:18', wwScore: 37, ptScore: 79 },
  { num: '12', first: 'Liezel', last: 'Lopez', grade: 85, att: 'present', inTime: '07:02', wwScore: 42, ptScore: 86 },
  { num: '13', first: 'Mark', last: 'Mercado', grade: 71, att: 'present', inTime: '07:24', wwScore: 33, ptScore: null }, // missing PT
  { num: '14', first: 'Nicole', last: 'Rivera', grade: 87, att: 'late', inTime: '07:38', wwScore: 43, ptScore: 88 },      // late
  { num: '15', first: 'Oliver', last: 'Castillo', grade: 83, att: 'present', inTime: '07:11', wwScore: 41, ptScore: 84 },
  { num: '16', first: 'Patricia', last: 'Villanueva', grade: 90, att: 'present', inTime: '06:58', wwScore: 46, ptScore: 91 },
  { num: '17', first: 'Rafael', last: 'Aguilar', grade: 79, att: 'present', inTime: '07:14', wwScore: 38, ptScore: 80 },
  { num: '18', first: 'Samantha', last: 'Navarro', grade: 92, att: 'present', inTime: '07:01', wwScore: 48, ptScore: 93 },
  { num: '19', first: 'Tristan', last: 'Salazar', grade: 81, att: 'present', inTime: '07:22', wwScore: 39, ptScore: 82 },
  { num: '20', first: 'Vanessa', last: 'Del Rosario', grade: 85, att: 'present', inTime: '07:07', wwScore: 42, ptScore: 86 },
  { num: '21', first: 'Wilfred', last: 'Valdez', grade: 76, att: 'absent', wwScore: null, ptScore: 75 },                   // missing WW (chronic absences)
  { num: '22', first: 'Xander', last: 'Morales', grade: 88, att: 'absent', wwScore: 44, ptScore: 89 },
  { num: '23', first: 'Ysabel', last: 'Soriano', grade: 83, att: 'present', inTime: '07:09', wwScore: 41, ptScore: 84 },
  { num: '24', first: 'Zoren', last: 'Domingo', grade: null, att: 'present', inTime: '07:16', wwScore: null, ptScore: null }, // missing all grades
];

export async function seedFixture(): Promise<void> {
  console.log('[FIXTURE SEED] Starting synthetic Rizal section student fixture...');

  // 1. Verify section, academic year, and assignment exist
  const section = await prisma.section.findUnique({ where: { id: 'demo-sec-rizal10' } });
  if (!section) throw new Error('Section demo-sec-rizal10 not found. Run base seed first.');

  const ay = await prisma.academicYear.findUnique({ where: { id: 'demo-ay-2026' } });
  if (!ay) throw new Error('Academic year demo-ay-2026 not found. Run base seed first.');

  const roleStudent = await prisma.role.findUnique({ where: { name: 'Student' } });
  if (!roleStudent) throw new Error('Student role not found. Run base seed first.');

  const teacher = await prisma.teacher.findUnique({ where: { id: 'demo-teacher-1' } });
  if (!teacher) throw new Error('Teacher demo-teacher-1 not found. Run base seed first.');

  const term = await prisma.term.findFirst({ where: { academic_year_id: ay.id, key: 'T1' } });
  if (!term) throw new Error('Term T1 not found. Run base seed first.');

  const assignment = await prisma.teacherSubjectAssignment.findFirst({
    where: { section_id: section.id, teacher_id: teacher.id }
  });
  if (!assignment) throw new Error('TeacherSubjectAssignment for Rizal / Math not found.');

  // Valid, non-exposed bcrypt hash for inactive accounts
  const fixturePasswordHash = await bcrypt.hash(`FIXTURE_NON_LOGIN_${crypto.randomUUID()}`, 10);

  const today = new Date(new Date().setHours(0, 0, 0, 0));

  let usersCreated = 0;
  let studentsCreated = 0;
  let enrollmentsCreated = 0;
  let gradesCreated = 0;
  let attendanceCreated = 0;

  for (const s of FIXTURE_STUDENTS) {
    const userId = `fix-user-student-${s.num}`;
    const studentId = `fix-student-${s.num}`;
    const enrollmentId = `fix-enroll-${s.num}`;
    const email = `student_fixture_${s.num}@fixture.invalid`;
    const lrn = `1092837401${s.num}`;

    // 1. Inactive User
    await prisma.user.upsert({
      where: { id: userId },
      update: { status: 'inactive' },
      create: {
        id: userId,
        email,
        password_hash: fixturePasswordHash,
        first_name: s.first,
        last_name: s.last,
        status: 'inactive', // Strictly inactive to prevent login/session/token
      }
    });
    usersCreated++;

    // Role mapping
    await prisma.userRole.upsert({
      where: { user_id_role_id: { user_id: userId, role_id: roleStudent.id } },
      update: {},
      create: { user_id: userId, role_id: roleStudent.id }
    });

    // 2. Student Profile
    await prisma.student.upsert({
      where: { id: studentId },
      update: { current_section_id: section.id },
      create: {
        id: studentId,
        user_id: userId,
        lrn,
        grade_level: 10,
        current_section_id: section.id,
      }
    });
    studentsCreated++;

    // 3. Enrollment
    await prisma.enrollment.upsert({
      where: { id: enrollmentId },
      update: { status: 'Enrolled' },
      create: {
        id: enrollmentId,
        academic_year_id: ay.id,
        student_id: studentId,
        section_id: section.id,
        status: 'Enrolled',
      }
    });
    enrollmentsCreated++;

    // 4. Grade (Official Q1 Math 10 term record)
    if (s.grade !== null) {
      const gradeId = `fix-grade-${s.num}`;
      await prisma.grade.upsert({
        where: { id: gradeId },
        update: { term_grade: s.grade },
        create: {
          id: gradeId,
          student_id: studentId,
          subject_id: 'demo-subj-math10',
          term: 'T1',
          academic_year_id: ay.id,
          written_work: s.wwScore,
          performance_task: s.ptScore,
          term_assessment: s.grade,
          term_grade: s.grade,
        }
      });
      gradesCreated++;
    }

    // 5. Gate Attendance (today)
    if (s.att === 'present' || s.att === 'late') {
      const gateId = `fix-gate-${s.num}`;
      const [h, m] = (s.inTime || '07:00').split(':').map(Number);
      const timeIn = new Date(today);
      timeIn.setHours(h, m, 0, 0);

      await prisma.gateAttendance.upsert({
        where: { id: gateId },
        update: { time_in: timeIn, status: s.att === 'late' ? 'Late' : 'Present' },
        create: {
          id: gateId,
          student_id: studentId,
          date: today,
          time_in: timeIn,
          status: s.att === 'late' ? 'Late' : 'Present',
        }
      });
      attendanceCreated++;
    }
  }

  // 6. Excuse Letters
  await prisma.excuseLetter.upsert({
    where: { id: 'fix-excuse-01' },
    update: {},
    create: {
      id: 'fix-excuse-01',
      student_id: 'fix-student-01',
      teacher_id: teacher.id,
      reason: 'Medical consultation for severe asthma',
      status: 'Pending Review',
      start_date: today,
      end_date: today,
    }
  });

  await prisma.excuseLetter.upsert({
    where: { id: 'fix-excuse-02' },
    update: {},
    create: {
      id: 'fix-excuse-02',
      student_id: 'fix-student-04',
      teacher_id: teacher.id,
      reason: 'Family emergency / bereavement',
      status: 'Approved',
      teacher_note: 'Excused. Please complete assignments.',
      reviewed_at: new Date(),
      start_date: today,
      end_date: today,
    }
  });

  // 7. Gradebook (`gradebooks`) for Mathematics 10 / Rizal
  await prisma.gradebooks.upsert({
    where: { assignment_id_term_id: { assignment_id: assignment.id, term_id: term.id } },
    update: {},
    create: {
      id: 'fix-gb-math10',
      assignment_id: assignment.id,
      term_id: term.id,
      status: 'Draft',
      version: 1,
      updated_at: new Date(),
    }
  });

  // 8. Gradebook Columns (`gradebook_columns`)
  await prisma.gradebook_columns.upsert({
    where: { id: 'fix-col-ww1' },
    update: {},
    create: {
      id: 'fix-col-ww1',
      gradebook_id: 'fix-gb-math10',
      type: 'WW',
      label: 'Written Work 1 (Quiz: Polynomials)',
      max_score: 50,
      sort_order: 1,
      updated_at: new Date(),
    }
  });

  await prisma.gradebook_columns.upsert({
    where: { id: 'fix-col-pt1' },
    update: {},
    create: {
      id: 'fix-col-pt1',
      gradebook_id: 'fix-gb-math10',
      type: 'PT',
      label: 'Performance Task 1 (Geometric Modeling)',
      max_score: 100,
      sort_order: 2,
      updated_at: new Date(),
    }
  });

  // 9. Grade Entries (`grade_entries`)
  let gradeEntriesCreated = 0;
  for (const s of FIXTURE_STUDENTS) {
    const enrollmentId = `fix-enroll-${s.num}`;

    // WW1 Entry (if not missing)
    if (s.wwScore !== null) {
      const entryId = `fix-ge-ww1-${s.num}`;
      await prisma.grade_entries.upsert({
        where: { id: entryId },
        update: { score: s.wwScore },
        create: {
          id: entryId,
          column_id: 'fix-col-ww1',
          enrollment_id: enrollmentId,
          score: s.wwScore, // Includes legitimate 0 for student 06
          created_by: teacher.user_id,
        }
      });
      gradeEntriesCreated++;
    }

    // PT1 Entry (if not missing)
    if (s.ptScore !== null) {
      const entryId = `fix-ge-pt1-${s.num}`;
      await prisma.grade_entries.upsert({
        where: { id: entryId },
        update: { score: s.ptScore },
        create: {
          id: entryId,
          column_id: 'fix-col-pt1',
          enrollment_id: enrollmentId,
          score: s.ptScore,
          created_by: teacher.user_id,
        }
      });
      gradeEntriesCreated++;
    }
  }

  // 10. Class Attendance (`class_attendance`)
  // 5 historical class sessions: Day -4, Day -3, Day -2, Day -1, Day 0
  let classAttendanceCreated = 0;
  const attendanceDates: Date[] = [];
  for (let d = 4; d >= 0; d--) {
    const date = new Date(today);
    date.setDate(date.getDate() - d);
    attendanceDates.push(date);
  }

  for (const s of FIXTURE_STUDENTS) {
    const enrollmentId = `fix-enroll-${s.num}`;

    for (let dayIdx = 0; dayIdx < attendanceDates.length; dayIdx++) {
      const date = attendanceDates[dayIdx];
      const attId = `fix-ca-${s.num}-d${dayIdx}`;

      let status = 'P'; // default Present
      let remarks: string | null = null;

      if (s.num === '21') {
        // Wilfred Valdez: 4 Absences (Days 0, 1, 2, 3) + 1 Late (Day 4) -> 3+ Absences!
        if (dayIdx < 4) {
          status = 'A';
          remarks = 'Unexcused absence';
        } else {
          status = 'L';
          remarks = 'Tardy 15 mins';
        }
      } else if (s.num === '01') {
        // Angelo Santos: Mix of P, L, E
        if (dayIdx === 1) {
          status = 'L';
          remarks = 'Late arrival';
        } else if (dayIdx === 3) {
          status = 'E';
          remarks = 'Excused due to asthma';
        } else {
          status = 'P';
        }
      } else if (s.num === '06') {
        // Francis Garcia: 2 Absences
        if (dayIdx === 2 || dayIdx === 4) {
          status = 'A';
          remarks = 'Unexcused';
        } else {
          status = 'P';
        }
      } else if (s.num === '09' || s.num === '14') {
        // Tardy students
        if (dayIdx === 0 || dayIdx === 2) {
          status = 'L';
          remarks = 'Tardy';
        } else {
          status = 'P';
        }
      } else {
        // Normal distribution: 95% Present, occasional random late/excused
        status = dayIdx === 3 && s.num === '04' ? 'E' : 'P';
      }

      await prisma.classAttendance.upsert({
        where: {
          assignment_id_enrollment_id_date: {
            assignment_id: assignment.id,
            enrollment_id: enrollmentId,
            date,
          }
        },
        update: { status, remarks },
        create: {
          id: attId,
          assignment_id: assignment.id,
          enrollment_id: enrollmentId,
          date,
          status,
          remarks,
        }
      });
      classAttendanceCreated++;
    }
  }

  // 11. Appointments (`appointments`)
  // 2 appointments assigned to Maria Clara (demo-teacher-1)
  const nextTuesday = new Date(today);
  nextTuesday.setDate(nextTuesday.getDate() + 4);

  const nextThursday = new Date(today);
  nextThursday.setDate(nextThursday.getDate() + 6);

  await prisma.appointment.upsert({
    where: { id: 'fix-appt-01' },
    update: { date: today, status: 'Confirmed' },
    create: {
      id: 'fix-appt-01',
      student_id: 'fix-student-01', // Angelo Santos
      teacher_id: teacher.id,
      date: today,
      time: new Date('1970-01-01T10:00:00.000Z'),
      purpose: 'Parent consultation regarding first quarter academic progress and project submission',
      status: 'Confirmed',
      direction: 'Inbound',
    }
  });

  await prisma.appointment.upsert({
    where: { id: 'fix-appt-02' },
    update: {},
    create: {
      id: 'fix-appt-02',
      student_id: 'fix-student-21', // Wilfred Valdez (student with 3+ absences)
      teacher_id: teacher.id,
      date: nextThursday,
      time: new Date('1970-01-01T14:00:00.000Z'),
      purpose: 'Follow-up conference on consecutive unexcused class attendance absences',
      status: 'Pending',
      direction: 'Outbound',
    }
  });

  console.log('[FIXTURE SEED COMPLETED]');
  console.log({
    syntheticUsers: usersCreated,
    syntheticStudents: studentsCreated,
    syntheticEnrollments: enrollmentsCreated,
    syntheticGrades: gradesCreated,
    syntheticAttendanceRecords: attendanceCreated,
    syntheticExcuseLetters: 2,
    syntheticGradebooks: 1,
    syntheticGradebookColumns: 2,
    syntheticGradeEntries: gradeEntriesCreated,
    syntheticClassAttendance: classAttendanceCreated,
    syntheticAppointments: 2,
  });
}

// Direct invocation check
if (process.argv[1]?.endsWith('seed-teacher-demo-fixture.ts')) {
  seedFixture()
    .catch((err) => {
      console.error('[FIXTURE SEED FAILED]', err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
