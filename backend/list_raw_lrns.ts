import { PrismaClient } from '@prisma/client';
import { decryptField } from './src/common/utils/encryption.js';

const prisma = new PrismaClient();

async function main() {
  const students = await prisma.student.findMany({
    include: { user: true },
  });
  console.log("--- STUDENT LRNS ---");
  students.forEach((s) => {
    try {
      const rawLrn = decryptField(s.lrn);
      console.log(`Student: ${s.user.first_name} ${s.user.last_name} | LRN: ${rawLrn}`);
    } catch (err) {
      console.log(`Student: ${s.user.first_name} ${s.user.last_name} | Encrypted LRN: ${s.lrn}`);
    }
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
