import prisma from './src/config/database.js';

async function main() {
  console.log('--- Migrating Students ---');
  const students = await prisma.student.findMany();
  for (const s of students) {
    await prisma.student.update({
      where: { id: s.id },
      data: {
        lrn: s.lrn,
        guardian_phone: s.guardian_phone,
        guardian_email: s.guardian_email,
        blood_type: s.blood_type,
        allergies: s.allergies,
        medical_conditions: s.medical_conditions
      }
    });
    console.log(`Migrated student: ${s.id}`);
  }

  console.log('\n--- Migrating ClinicReferrals ---');
  const clinicReferrals = await prisma.clinicReferral.findMany();
  for (const c of clinicReferrals) {
    await prisma.clinicReferral.update({
      where: { id: c.id },
      data: {
        symptoms: c.symptoms,
        diagnosis: c.diagnosis,
        medications: c.medications,
        treatments: c.treatments,
        notes: c.notes
      }
    });
    console.log(`Migrated clinic referral: ${c.id}`);
  }

  console.log('\n--- Migrating GuidanceRecords ---');
  const guidanceRecords = await prisma.guidanceRecord.findMany();
  for (const g of guidanceRecords) {
    await prisma.guidanceRecord.update({
      where: { id: g.id },
      data: {
        reason: g.reason,
        notes: g.notes,
        action_taken: g.action_taken
      }
    });
    console.log(`Migrated guidance record: ${g.id}`);
  }

  console.log('\n--- VERIFICATION (Row Counts) ---');
  console.log(`Student: ${await prisma.student.count()}`);
  console.log(`ClinicReferral: ${await prisma.clinicReferral.count()}`);
  console.log(`GuidanceRecord: ${await prisma.guidanceRecord.count()}`);

  console.log('\n--- Spot Check Second Student ---');
  if (students.length > 1) {
    const secondStudent = students[1];
    
    // Raw query
    const raw: any[] = await prisma.$queryRaw`SELECT guardian_phone, guardian_email FROM students WHERE id = ${secondStudent.id}`;
    if (raw.length > 0) {
      console.log(`Raw DB guardian_phone: ${raw[0].guardian_phone}`);
      console.log(`Raw DB guardian_email: ${raw[0].guardian_email}`);
    }

    // Prisma query
    const fetched = await prisma.student.findUnique({ where: { id: secondStudent.id } });
    console.log(`Decrypted guardian_phone via Prisma: ${fetched?.guardian_phone}`);
    console.log(`Decrypted guardian_email via Prisma: ${fetched?.guardian_email}`);
  }

}

main().finally(() => prisma.$disconnect());
