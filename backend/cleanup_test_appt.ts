import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const testAppts = await prisma.appointment.findMany({
    where: { purpose: { contains: 'API Test' } }
  });

  if (testAppts.length > 0) {
    // Keep the first one, delete the rest
    const toKeep = testAppts[0];
    const toDelete = testAppts.slice(1);

    for (const appt of toDelete) {
      await prisma.appointment.delete({ where: { id: appt.id } });
      console.log(`Deleted duplicate test appointment: ${appt.id}`);
    }

    // Rename the one we kept
    await prisma.appointment.update({
      where: { id: toKeep.id },
      data: { purpose: 'Discuss upcoming project and behavior' }
    });
    console.log(`Updated remaining test appointment to realistic purpose: ${toKeep.id}`);
  } else {
    console.log("No test appointments found.");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
