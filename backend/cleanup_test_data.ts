import prisma from './src/config/database';

async function main() {
  const records = await prisma.guidanceRecord.findMany();
  let deleted = 0;
  for (const r of records) {
    if (r.notes === 'G1-DOM-GUIDANCE-VERIFY' || (r.reason && r.reason.includes('G1-DOM'))) {
      await prisma.guidanceRecord.delete({ where: { id: r.id } });
      deleted++;
    }
  }
  console.log('Deleted guidance records:', deleted);
  
  const b = await prisma.$executeRaw`DELETE FROM behavior_logs WHERE type = 'G1-DOM-BEHAVIOR-VERIFY'`;
  const a = await prisma.$executeRaw`DELETE FROM appointments WHERE purpose = 'G1-DOM-APPOINTMENT-VERIFY'`;
  console.log(`Deleted ${b} behavior logs, ${a} appointments`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
