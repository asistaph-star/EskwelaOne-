import jwt from 'jsonwebtoken';
import fs from 'fs';
import prisma from '../src/config/database.js';

async function main() {
  const principal = await (prisma as any).user.findFirst({
    where: { school_id: 'EMP-QA-P01' },
    include: { user_roles: { include: { role: true } } },
  });

  if (!principal) {
    console.error('Principal user not found!');
    return;
  }

  const roles = principal.user_roles.map((ur: any) => ur.role.name);
  console.log('Principal user found:', principal.id, 'Roles:', roles);

  const token = jwt.sign(
    {
      id: principal.id,
      userId: principal.id,
      username: principal.school_id,
      roles: roles.length ? roles : ['Principal'],
      firstName: principal.first_name,
      lastName: principal.last_name,
    },
    'super_secret_jwt_key_1234567890123456',
    { expiresIn: '1h' }
  );

  // 1. Test Aguinaldo overview
  const aguinaldoSecId = '01a1bfd5-2089-766b-b8e9-f3b2aadee893';
  const resAguinaldo = await fetch(`http://localhost:4001/api/academic/report-card/sections/${aguinaldoSecId}/overview?term=T1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const dataAguinaldo = await resAguinaldo.json();
  console.log('\n--- Aguinaldo Overview Result ---');
  console.log('Status code:', resAguinaldo.status);
  console.log('Stats:', dataAguinaldo.data?.stats);
  console.log('Learners:');
  dataAguinaldo.data?.learners?.forEach((l: any) => {
    console.log(`- ${l.name} (LRN: ${l.lrn}): Eligible=${l.eligibility?.isEligible}, Authorized=${l.principalAuthorization?.isAuthorized}, Issued=${l.issuance?.isIssued}, Blockers=${l.eligibility?.blockingReasons?.length}`);
    l.eligibility?.blockingReasons?.forEach((b: string) => console.log(`    * ${b}`));
  });

  // 2. Test Rizal overview (Hannah Torres)
  const rizalSecId = 'c091a392-3c56-4a5c-9fc8-69d9823c6945';
  const resRizal = await fetch(`http://localhost:4001/api/academic/report-card/sections/${rizalSecId}/overview?term=T1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const dataRizal = await resRizal.json();
  console.log('\n--- Rizal Overview Result ---');
  console.log('Status code:', resRizal.status);
  console.log('Stats:', dataRizal.data?.stats);
  console.log('Learners:');
  dataRizal.data?.learners?.forEach((l: any) => {
    console.log(`- ${l.name} (LRN: ${l.lrn}): Eligible=${l.eligibility?.isEligible}, Blockers=${l.eligibility?.blockingReasons?.length}`);
    l.eligibility?.blockingReasons?.forEach((b: string) => console.log(`    * ${b}`));
  });

  fs.writeFileSync('c:/Users/Admin/Documents/Capstone Project/DigiSkwela/backend/scripts/overview_endpoint_test_result.json', JSON.stringify({ aguinaldo: dataAguinaldo, rizal: dataRizal }, null, 2));
}

main().finally(() => prisma.$disconnect());
