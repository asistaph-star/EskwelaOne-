import prisma from './src/config/database.js';

async function main() {
  console.log('--- Checking Student Records in Strict Mode ---');
  const students = await prisma.student.findMany();
  for (const s of students) {
    console.log(`Student ID: ${s.id}`);
    console.log(`  LRN (decrypted): ${s.lrn}`);
    console.log(`  Guardian Phone (optional, decrypted): ${s.guardian_phone === null ? 'NULL' : s.guardian_phone}`);
  }

  console.log('\n--- Checking ClinicReferral Records in Strict Mode ---');
  const referrals = await prisma.clinicReferral.findMany();
  for (const r of referrals) {
    console.log(`Referral ID: ${r.id}`);
    console.log(`  Symptoms (decrypted): ${r.symptoms === null ? 'NULL' : r.symptoms}`);
    console.log(`  Diagnosis (decrypted): ${r.diagnosis === null ? 'NULL' : r.diagnosis}`);
  }
}

main().finally(() => prisma.$disconnect());
