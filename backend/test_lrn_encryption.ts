import prisma from './src/config/database.js';

async function main() {
  // 1. Pick ONE Student record
  const student = await prisma.student.findFirst();
  if (!student) throw new Error("No student found");

  const originalLrn = student.lrn;
  console.log(`Original LRN: ${originalLrn}`);

  // 2. Run the update on just that one (re-saving same values)
  await prisma.student.update({
    where: { id: student.id },
    data: {
      lrn: originalLrn,
      guardian_phone: student.guardian_phone,
      guardian_email: student.guardian_email,
      blood_type: student.blood_type,
      allergies: student.allergies,
      medical_conditions: student.medical_conditions
    }
  });
  console.log(`Updated student ${student.id}`);

  // 3. Verify lrn is ciphertext directly via raw SQL
  const rawStudent: any[] = await prisma.$queryRaw`SELECT lrn, lrn_hash FROM students WHERE id = ${student.id}`;
  if (rawStudent.length > 0) {
    console.log(`Raw DB lrn (should be ciphertext): ${rawStudent[0].lrn}`);
    console.log(`Raw DB lrn_hash (should be hash): ${rawStudent[0].lrn_hash}`);
  }

  // 4. Verify findUnique with the real original LRN works
  const fetchedStudent = await prisma.student.findUnique({
    where: { lrn: originalLrn }
  });
  
  if (fetchedStudent) {
    console.log(`findUnique(lrn) success! Found student ID: ${fetchedStudent.id}`);
    console.log(`Decrypted LRN returned by Prisma: ${fetchedStudent.lrn}`);
  } else {
    console.log(`findUnique(lrn) FAILED! Could not find student.`);
  }

}

main().finally(() => prisma.$disconnect());
