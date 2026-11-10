import jwt from 'jsonwebtoken';
import prisma from '../src/config/database.js';

async function main() {
  const principal = await (prisma as any).user.findFirst({
    where: { school_id: 'EMP-QA-P01' },
    include: { user_roles: { include: { role: true } } },
  });

  const principalToken = jwt.sign(
    {
      id: principal.id,
      userId: principal.id,
      username: principal.school_id,
      roles: ['Principal'],
      firstName: principal.first_name,
      lastName: principal.last_name,
    },
    'super_secret_jwt_key_1234567890123456',
    { expiresIn: '1h' }
  );

  // Find Term 1
  const t1 = await (prisma as any).term.findFirst({ where: { key: 'T1' } });
  console.log(`Term 1 ID: ${t1.id}, Key: ${t1.key}`);

  // Find Carlos Garcia (unreleased student)
  const carlos = await (prisma as any).student.findFirst({
    where: { lrn: '999026000033' },
    include: { user: true },
  });
  const carlosToken = jwt.sign(
    {
      id: carlos.user_id,
      userId: carlos.user_id,
      username: carlos.lrn,
      roles: ['Student'],
      firstName: carlos.user?.first_name,
      lastName: carlos.user?.last_name,
      studentProfile: { id: carlos.id },
    },
    'super_secret_jwt_key_1234567890123456',
    { expiresIn: '1h' }
  );

  // 1. Fetch Carlos grades with visibility = true (default)
  let res = await fetch(`http://localhost:4001/api/academic/report-card/${carlos.id}`, {
    headers: { Authorization: `Bearer ${carlosToken}` },
  });
  let json = await res.json();
  const sampleGrade1 = json.data?.scholastic?.subjects[0];
  console.log('With visibility=TRUE: Carlos Subject 1:', sampleGrade1?.name, 'T1=', sampleGrade1?.T1);

  // 2. Toggle visibility to FALSE
  console.log('\nToggling visibility to FALSE...');
  let patchRes = await fetch(`http://localhost:4001/api/academic/terms/${t1.id}/visibility`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${principalToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ isVisible: false }),
  });
  console.log('Toggle response:', await patchRes.json());

  // 3. Fetch Carlos grades with visibility = false
  res = await fetch(`http://localhost:4001/api/academic/report-card/${carlos.id}`, {
    headers: { Authorization: `Bearer ${carlosToken}` },
  });
  json = await res.json();
  const sampleGrade2 = json.data?.scholastic?.subjects[0];
  console.log('With visibility=FALSE: Carlos Subject 1:', sampleGrade2?.name, 'T1=', sampleGrade2?.T1);

  // 4. Reset visibility back to TRUE
  console.log('\nResetting visibility back to TRUE...');
  await fetch(`http://localhost:4001/api/academic/terms/${t1.id}/visibility`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${principalToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ isVisible: true }),
  });
  console.log('Reset complete.');
}

main().finally(() => prisma.$disconnect());
