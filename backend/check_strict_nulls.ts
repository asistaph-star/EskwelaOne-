import prisma from './src/config/database.js';

async function main() {
  const students = await prisma.student.findMany();
  const s2 = students[1];
  console.log(`Student ID: ${s2.id}`);
  console.log(`  Guardian Email: ${s2.guardian_email === null ? 'NULL' : s2.guardian_email}`);
  console.log(`  Blood Type: ${s2.blood_type === null ? 'NULL' : s2.blood_type}`);
}

main().finally(() => prisma.$disconnect());
