import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding demo accounts and relational data...');
  const passwordHash = await bcrypt.hash('password123', 10);

  // Helper to ensure role exists
  async function ensureRole(name: string) {
    let role = await prisma.role.findUnique({ where: { name } });
    if (!role) {
      role = await prisma.role.create({ data: { id: uuidv4(), name } });
    }
    return role;
  }

  const roleStudent = await ensureRole('Student');
  const roleTeacher = await ensureRole('Teacher');
  const roleNurse = await ensureRole('Nurse');
  const rolePrincipal = await ensureRole('Principal');
  const roleGuidance = await ensureRole('Guidance');
  const roleAdmin = await ensureRole('Admin');
  const roleRegistrar = await ensureRole('Registrar');

  // Helper to create user
  async function ensureUser(id: string, email: string, firstName: string, lastName: string, roleId: string) {
    const user = await prisma.user.upsert({
      where: { id },
      update: { email, password_hash: passwordHash, first_name: firstName, last_name: lastName },
      create: {
        id,
        email,
        password_hash: passwordHash,
        first_name: firstName,
        last_name: lastName,
        status: 'active',
      }
    });

    await prisma.userRole.upsert({
      where: { user_id_role_id: { user_id: id, role_id: roleId } },
      update: {},
      create: { user_id: id, role_id: roleId }
    });

    return user;
  }

  const studentUser = await ensureUser('demo-student-1', 'student@demo.com', 'Juan', 'Dela Cruz', roleStudent.id);
  const teacherUser = await ensureUser('demo-teacher-1', 'teacher@demo.com', 'Maria', 'Clara', roleTeacher.id);
  const nurseUser = await ensureUser('demo-nurse-1', 'nurse@demo.com', 'Florence', 'Nightingale', roleNurse.id);
  const principalUser = await ensureUser('demo-principal-1', 'principal@demo.com', 'Jose', 'Rizal', rolePrincipal.id);
  const guidanceUser = await ensureUser('demo-guidance-1', 'guidance@demo.com', 'Sigmund', 'Freud', roleGuidance.id);
  const adminUser = await ensureUser('demo-admin-1', 'admin@demo.com', 'System', 'Admin', roleAdmin.id);
  const registrarUser = await ensureUser('demo-registrar-1', 'registrar@demo.com', 'Records', 'Officer', roleRegistrar.id);

  // Ensure Academic Year & Term
  const ayId = 'demo-ay-2026';
  await prisma.academicYear.updateMany({
    where: { id: { not: ayId } },
    data: { is_current: false }
  });
  await prisma.academicYear.upsert({
    where: { id: ayId },
    update: { is_current: true },
    create: { id: ayId, name: 'SY 2026-2027', start_date: new Date('2026-08-01'), end_date: new Date('2027-05-31'), is_current: true }
  });

  const termId = 'demo-term-1';
  await prisma.term.upsert({
    where: { id: termId },
    update: {},
    create: { id: termId, academic_year_id: ayId, name: 'First Quarter', key: 'T1' }
  });

  // Ensure Subject & Section
  const subjectId = 'demo-subj-math10';
  await prisma.subject.upsert({
    where: { code: 'MATH10' },
    update: {},
    create: { id: subjectId, code: 'MATH10', name: 'Mathematics 10' }
  });

  const sectionId = 'demo-sec-rizal10';
  const existingSection = await prisma.section.findFirst({
    where: { academic_year_id: ayId, name: 'Rizal', grade_level: 10 }
  });
  const finalSectionId = existingSection ? existingSection.id : sectionId;
  if (!existingSection) {
    await prisma.section.create({
      data: { id: finalSectionId, academic_year_id: ayId, name: 'Rizal', grade_level: 10 }
    });
  }

  // Ensure Teacher Profile
  await prisma.teacher.upsert({
    where: { user_id: teacherUser.id },
    update: {},
    create: { id: teacherUser.id, user_id: teacherUser.id, employee_id: 'EMP-T-001', department: 'Mathematics' }
  });

  // Ensure Teacher Assignment
  const assignmentId = 'demo-assign-1';
  await prisma.teacherSubjectAssignment.upsert({
    where: { academic_year_id_teacher_id_section_id_subject_id: { academic_year_id: ayId, teacher_id: teacherUser.id, section_id: finalSectionId, subject_id: subjectId } },
    update: {},
    create: { id: assignmentId, academic_year_id: ayId, teacher_id: teacherUser.id, section_id: finalSectionId, subject_id: subjectId }
  });

  // Ensure Student Profile
  await prisma.student.upsert({
    where: { user_id: studentUser.id },
    update: { current_section_id: finalSectionId },
    create: {
      id: studentUser.id,
      user_id: studentUser.id,
      lrn: '123456789012',
      grade_level: 10,
      current_section_id: finalSectionId,
      blood_type: 'O+',
      allergies: 'Peanuts',
      medical_conditions: 'Asthma'
    }
  });

  // Ensure Student Enrollment
  const enrollmentId = 'demo-enroll-1';
  await prisma.enrollment.upsert({
    where: { id: enrollmentId },
    update: {},
    create: { id: enrollmentId, academic_year_id: ayId, student_id: studentUser.id, section_id: finalSectionId, status: 'Enrolled' }
  });

  // Staff/Nurse/Guidance profiles
  await prisma.staff.upsert({
    where: { user_id: nurseUser.id },
    update: {},
    create: { id: nurseUser.id, user_id: nurseUser.id, employee_id: 'EMP-N-001', department: 'Clinic', position: 'School Nurse' }
  });
  await prisma.staff.upsert({
    where: { user_id: guidanceUser.id },
    update: {},
    create: { id: guidanceUser.id, user_id: guidanceUser.id, employee_id: 'EMP-G-001', department: 'Guidance', position: 'Counselor' }
  });
  await prisma.staff.upsert({
    where: { user_id: principalUser.id },
    update: {},
    create: { id: principalUser.id, user_id: principalUser.id, employee_id: 'EMP-P-001', department: 'Administration', position: 'Principal' }
  });

  // Clinic Referral (Nurse)
  await prisma.clinicReferral.upsert({
    where: { id: 'demo-clinic-ref-1' },
    update: {},
    create: {
      id: 'demo-clinic-ref-1',
      student_id: studentUser.id,
      date: new Date(),
      symptoms: 'Mild headache',
      diagnosis: 'Tension headache',
      medications: 'Paracetamol',
      treatments: 'Rest for 30 minutes',
      recorded_by: nurseUser.id
    }
  });

  // Guidance Record (Guidance)
  await prisma.guidanceRecord.upsert({
    where: { id: 'demo-guidance-ref-1' },
    update: {},
    create: {
      id: 'demo-guidance-ref-1',
      student_id: studentUser.id,
      counselor_id: guidanceUser.id,
      date: new Date(),
      type: 'Routine Check-in',
      reason: 'Academic stress',
      notes: 'Student doing well, recommended study habits.',
      action_taken: 'Provided study guide'
    }
  });

  // Leave Request (Teacher -> Principal)
  await prisma.leaveRequest.upsert({
    where: { id: 'demo-leave-req-1' },
    update: {},
    create: {
      id: 'demo-leave-req-1',
      user_id: teacherUser.id,
      type: 'Sick Leave',
      start_date: new Date(),
      end_date: new Date(),
      days: 1,
      reason: 'Not feeling well',
      status: 'Pending'
    }
  });

  // Grade Entry
  await prisma.grade.upsert({
    where: { id: 'demo-grade-1' },
    update: {},
    create: {
      id: 'demo-grade-1',
      student_id: studentUser.id,
      subject_id: subjectId,
      term: 'T1',
      academic_year_id: ayId,
      written_work: 85,
      performance_task: 90,
      term_assessment: 88,
      term_grade: 88
    }
  });

  // Gate Attendance
  const gateId = 'demo-gate-1';
  const existingGate = await prisma.gateAttendance.findFirst({
    where: { student_id: studentUser.id, date: new Date(new Date().setHours(0,0,0,0)) }
  });
  if (!existingGate) {
    await prisma.gateAttendance.create({
      data: {
        id: gateId,
        student_id: studentUser.id,
        date: new Date(new Date().setHours(0,0,0,0)),
        time_in: new Date(),
        status: 'Present'
      }
    });
  }

  console.log('Seed complete!');
  console.log('Demo Credentials (Password: password123):');
  console.log('- Student: student@demo.com');
  console.log('- Teacher: teacher@demo.com');
  console.log('- Nurse: nurse@demo.com');
  console.log('- Principal: principal@demo.com');
  console.log('- Guidance: guidance@demo.com');
  console.log('- Admin: admin@demo.com');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
