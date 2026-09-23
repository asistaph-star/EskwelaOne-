import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const allAppointments = await prisma.appointment.findMany();
  let validCount = 0;
  let invalidCount = 0;
  let missingTeacherCount = 0;
  
  for (const appt of allAppointments) {
    if (!appt.teacher_id) {
      missingTeacherCount++;
      invalidCount++;
      console.error(`Appointment ${appt.id} is missing a teacher_id!`);
    } else {
      validCount++;
    }
  }

  console.log('--- READ-ONLY APPOINTMENT AUDIT ---');
  console.log(`Total Appointments: ${allAppointments.length}`);
  console.log(`Valid (has teacher_id): ${validCount}`);
  console.log(`Invalid (missing teacher_id): ${invalidCount}`);
  
  if (invalidCount > 0) {
    console.error('FAILED AUDIT: Existing data violates invariants.');
    process.exit(1);
  } else {
    console.log('SUCCESS: All existing appointments have a teacher_id.');
  }
}

check().catch(console.error).finally(() => prisma.$disconnect());
