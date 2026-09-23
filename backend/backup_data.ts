import prisma from './src/config/database.js';
import fs from 'fs';

async function backup() {
  console.log('Backing up Student table...');
  const students = await prisma.student.findMany();
  fs.writeFileSync('backup_students.json', JSON.stringify(students, null, 2));
  console.log(`Saved ${students.length} students to backup_students.json`);

  console.log('Backing up ClinicReferral table...');
  const clinicReferrals = await prisma.clinicReferral.findMany();
  fs.writeFileSync('backup_clinic_referrals.json', JSON.stringify(clinicReferrals, null, 2));
  console.log(`Saved ${clinicReferrals.length} clinic referrals to backup_clinic_referrals.json`);

  console.log('Backup complete.');
}

backup().finally(() => prisma.$disconnect());
