import prisma from './src/config/database.js';

async function clean() {
  const referrals = await prisma.clinicReferral.findMany();
  
  let deletedCount = 0;
  for (const ref of referrals) {
    if (ref.diagnosis && ref.diagnosis.includes('N1-CLINIC-DOM-VERIFY')) {
      await prisma.clinicReferral.delete({ where: { id: ref.id } });
      deletedCount++;
    }
  }
  
  console.log(`Deleted ${deletedCount} leftover DOM-VERIFY test records.`);
}

clean().catch(console.error).finally(() => prisma.$disconnect());
