import prisma from './src/config/database.js';

async function check() {
  const referrals = await prisma.clinicReferral.findMany();
  console.log(JSON.stringify(referrals, null, 2));
}

check().catch(console.error).finally(() => prisma.$disconnect());
