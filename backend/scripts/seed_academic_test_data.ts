import { PrismaClient } from '@prisma/client';
import { createUser } from '../src/users/user.service.js';
import { createAcademicYear, createSubject, createSection, assignTeacherToSubject } from '../src/academic/academic.service.js';
import { createInitialEnrollment } from '../src/enrollments/enrollment.service.js';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting Academic Test Data Seeding...');
  
  const adminActorId = 'system'; 

  // 1. Create Teacher User
  console.log('Creating Teacher...');
  const teacherEmail = `teacher_${Date.now()}@example.com`;
  const teacherUser = await createUser({
    email: teacherEmail,
    password: 'password123',
    firstName: 'Test',
    lastName: 'Teacher',
    roles: ['Teacher'],
  }, adminActorId);
  const teacherId = teacherUser.teacher_profile!.id;
  console.log(`Teacher created: ${teacherEmail} (ID: ${teacherId})`);

  // 2. Create Student User
  console.log('Creating Student...');
  const studentEmail = `student_${Date.now()}@example.com`;
  const studentUser = await createUser({
    email: studentEmail,
    password: 'password123',
    firstName: 'Test',
    lastName: 'Student',
    roles: ['Student'],
  }, adminActorId);
  const studentId = studentUser.student_profile!.id;
  console.log(`Student created: ${studentEmail} (ID: ${studentId})`);

  // 3. Create Academic Year (will auto-create Terms T1-T4)
  console.log('Creating Academic Year...');
  const ayName = `2024-2025 Test ${Date.now()}`;
  const academicYear = await createAcademicYear({
    name: ayName,
    startDate: new Date('2024-08-01').toISOString(),
    endDate: new Date('2025-05-31').toISOString(),
  }, adminActorId);
  console.log(`Academic Year created: ${ayName} (ID: ${academicYear.id})`);

  // 4. Create Subject
  console.log('Creating Subject...');
  const subjectCode = `MATH${Date.now()}`;
  const subject = await createSubject({
    name: 'Mathematics Test',
    code: subjectCode,
    description: 'Test subject',
  }, adminActorId);
  console.log(`Subject created: ${subjectCode} (ID: ${subject.id})`);

  // 5. Create Section
  console.log('Creating Section...');
  const sectionName = `Grade 10 - Test ${Date.now()}`;
  const section = await createSection({
    name: sectionName,
    academicYearId: academicYear.id,
    capacity: 30,
  }, adminActorId);
  console.log(`Section created: ${sectionName} (ID: ${section.id})`);

  // 6. Assign Teacher to Subject/Section
  console.log('Assigning Teacher to Subject...');
  const assignment = await assignTeacherToSubject({
    teacherId: teacherId,
    subjectId: subject.id,
    sectionId: section.id,
    academicYearId: academicYear.id,
  }, adminActorId);
  console.log(`Teacher Assignment created (ID: ${assignment.id})`);

  // 7. Enroll Student in Section
  console.log('Enrolling Student...');
  const enrollment = await createInitialEnrollment({
    studentId: studentId,
    sectionId: section.id,
    academicYearId: academicYear.id,
  }, adminActorId);
  console.log(`Enrollment created (ID: ${enrollment.id})`);

  console.log('=============================================');
  console.log('Test Data Provisioning Complete!');
  console.log('Login credentials:');
  console.log(`Teacher Email: ${teacherEmail}`);
  console.log(`Teacher Password: password123`);
  console.log(`Student Email: ${studentEmail}`);
  console.log(`Student Password: password123`);
  console.log('=============================================');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
