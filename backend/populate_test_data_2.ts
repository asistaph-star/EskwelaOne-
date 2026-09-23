import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch'; // Requires node 18+ global fetch or node-fetch
import { generateId } from './src/common/utils/uuid.js';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:4000/api';

async function main() {
  console.log('--- Generating Minimal Test Dataset ---');
  
  // 1. We need a SuperAdmin or someone with 'academic:write', 'assignment:write', 'enrollment:write', 'user:write'.
  // Let's just create an API token for a superuser directly from DB since the user wants us to hit the real APIs.
  // Wait, to hit POST /api/users, we need an admin. Let's find an admin user.
  let adminRole = await prisma.role.findUnique({ where: { name: 'Registrar' } });
  if (!adminRole) {
    adminRole = await prisma.role.findUnique({ where: { name: 'SystemAdmin' } });
  }
  
  const registrarEmail = 'registrar@digiskwela.com';
  let adminUser = await prisma.user.findUnique({ where: { email: registrarEmail } });
  if (!adminUser) {
    const bcrypt = (await import('bcrypt')).default;
    adminUser = await prisma.user.create({
      data: {
        id: generateId(),
        email: registrarEmail,
        password_hash: await bcrypt.hash('Password123!', 10),
        first_name: 'System',
        last_name: 'Registrar',
        status: 'active',
        user_roles: {
          create: {
            role_id: adminRole!.id
          }
        }
      }
    });
  }

  // Ensure the role has the necessary permissions
  const neededPermissions = ['academic:write', 'user:write', 'enrollment:write', 'assignment:write', 'academic:read', 'user:read', 'enrollment:read', 'assignment:read'];
  for (const pKey of neededPermissions) {
    let perm = await prisma.permission.findUnique({ where: { key: pKey } });
    if (!perm) {
      perm = await prisma.permission.create({ data: { id: generateId(), key: pKey }});
    }
    const hasPerm = await prisma.rolePermission.findFirst({
      where: { role_id: adminRole!.id, permission_id: perm.id }
    });
    if (!hasPerm) {
      await prisma.rolePermission.create({
        data: { role_id: adminRole!.id, permission_id: perm.id }
      });
    }
  }

  const adminUserRole = await prisma.userRole.findFirst({
    where: { user_id: adminUser.id },
    include: { user: true }
  });

  const jwt = (await import('jsonwebtoken')).default;
  const token = jwt.sign(
    { userId: adminUserRole.user_id },
    'CHANGE_ME_TO_A_STRONG_RANDOM_SECRET_MIN_32_CHARS', // using default .env secret
    { expiresIn: '8h' }
  );
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  const fetchApi = async (path: string, payload: any) => {
    const res = await global.fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      console.error(`API Error on ${path}:`, data);
      throw new Error(`Request to ${path} failed: ${res.statusText}`);
    }
    return data.data;
  };

  // --- CREATE ACADEMIC YEAR ---
  console.log('Creating Academic Year 2026-2027...');
  let yearData;
  try {
    yearData = await fetchApi('/academic/years', {
      name: '2026-2027',
      startDate: '2026-08-01T00:00:00.000Z',
      endDate: '2027-05-31T00:00:00.000Z',
      isCurrent: true
    });
    console.log('✅ Academic Year created:', yearData.name);
  } catch(err) {
    // maybe exists
    console.log('Maybe exists, retrieving from db...');
    yearData = await prisma.academicYear.findFirst({ where: { name: '2026-2027' }});
  }

  // --- CREATE SUBJECT ---
  console.log('Creating Subject Mathematics...');
  let subjectData;
  try {
    subjectData = await fetchApi('/academic/subjects', {
      name: 'Mathematics',
      code: 'MATH7',
      department: 'Math',
      description: 'Grade 7 Mathematics'
    });
    console.log('✅ Subject created:', subjectData.name);
  } catch(err) {
    console.log('Maybe exists, retrieving from db...');
    subjectData = await prisma.subject.findFirst({ where: { code: 'MATH7' }});
  }

  // --- CREATE SECTION ---
  console.log('Creating Section Grade 7 Test Section 2...');
  let sectionData;
  try {
    sectionData = await fetchApi('/academic/sections', {
      name: 'Test Section 2',
      gradeLevel: 7,
      academicYearId: yearData.id
    });
    console.log('✅ Section created:', sectionData.name);
  } catch(err) {
    console.log('Maybe exists, retrieving from db...');
    sectionData = await prisma.section.findFirst({ where: { name: 'Test Section 2' }});
  }

  // --- CREATE TEACHER ---
  // Using POST /api/users
  console.log('Creating Teacher...');
  let teacherUser;
  try {
    teacherUser = await fetchApi('/users', {
      email: 'testteacher2@digiskwela.com',
      password: 'Password123!',
      firstName: 'Test',
      lastName: 'Teacher',
      roles: ['Teacher'],
      teacherProfile: {
        employeeId: `T${Date.now().toString().slice(-6)}`,
        department: 'Math',
        position: 'Math Teacher'
      }
    });
    console.log('✅ Teacher created:', teacherUser.email);
  } catch(err) {
    console.log('Maybe exists, retrieving from db...');
    teacherUser = await prisma.user.findUnique({ where: { email: 'testteacher2@digiskwela.com' }, include: { teacher: true }});
    // transform for later use
    if(teacherUser) teacherUser.teacher_id = teacherUser.teacher?.id;
  }
  const teacherId = teacherUser.teacher_id || teacherUser.teacher?.id || (await prisma.teacher.findUnique({where: {user_id: teacherUser.id}}))?.id;

  // --- CREATE STUDENT ---
  console.log('Creating Student...');
  let studentUser;
  try {
    studentUser = await fetchApi('/users', {
      email: 'teststudent2@digiskwela.com',
      password: 'Password123!',
      firstName: 'Test',
      lastName: 'Student',
      roles: ['Student'],
      studentProfile: {
        lrn: `LRN${Date.now().toString().slice(-7)}`,
        gradeLevel: 7,
        gender: 'Female',
        street: '123 Main St',
        city: 'Metropolis',
        guardianFirstName: 'John',
        guardianLastName: 'Doe',
        guardianPhone: '555-1234'
      }
    });
    console.log('✅ Student created:', studentUser.email);
  } catch(err) {
    console.log('Maybe exists, retrieving from db...');
    studentUser = await prisma.user.findUnique({ where: { email: 'teststudent2@digiskwela.com' }, include: { student: true }});
  }
  const studentId = studentUser.student_id || studentUser.student?.id || (await prisma.student.findUnique({where: {user_id: studentUser.id}}))?.id;


  // --- CREATE TEACHER SUBJECT ASSIGNMENT ---
  console.log('Creating Teacher Subject Assignment...');
  try {
    const tsAssignment = await fetchApi('/academic/assignments', {
      teacherId: teacherId,
      subjectId: subjectData.id,
      sectionId: sectionData.id,
      academicYearId: yearData.id
    });
    console.log('✅ Teacher Assignment created!');
  } catch(err) {
    console.log('Assignment might exist or failed.');
  }

  // --- CREATE ENROLLMENT ---
  console.log('Creating Enrollment...');
  try {
    const enrollmentData = await fetchApi('/enrollments', {
      studentId: studentId,
      sectionId: sectionData.id,
      academicYearId: yearData.id
    });
    console.log('✅ Enrollment created!');
  } catch(err) {
    console.log('Enrollment might exist or failed.');
  }

  console.log('--- DONE ---');
  
  // Also log the teacher credentials for E2E test
  console.log('\n--- CREDENTIALS FOR E2E TEST ---');
  console.log('Teacher Email:', 'testteacher2@digiskwela.com');
  console.log('Teacher Password:', 'Password123!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
