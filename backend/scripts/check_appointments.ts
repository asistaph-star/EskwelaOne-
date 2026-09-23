import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const teachers = await prisma.$queryRaw<any[]>`SELECT COUNT(*) FROM appointments WHERE teacher_id IS NOT NULL AND staff_id IS NULL`;
  const guidance = await prisma.$queryRaw<any[]>`SELECT COUNT(*) FROM appointments WHERE teacher_id IS NULL AND staff_id IS NOT NULL`;
  const invalid1 = await prisma.$queryRaw<any[]>`SELECT COUNT(*) FROM appointments WHERE teacher_id IS NULL AND staff_id IS NULL`;
  const invalid2 = await prisma.$queryRaw<any[]>`SELECT COUNT(*) FROM appointments WHERE teacher_id IS NOT NULL AND staff_id IS NOT NULL`;
  
  console.log('Teacher Appointments:', Number(teachers[0].count));
  console.log('Guidance Appointments:', Number(guidance[0].count));
  console.log('Invalid (Both NULL):', Number(invalid1[0].count));
  console.log('Invalid (Both NOT NULL):', Number(invalid2[0].count));
}

main().finally(() => prisma.$disconnect());
