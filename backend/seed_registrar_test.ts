import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function seed() {
  await prisma.enrollmentApplication.upsert({
    where: { id: 'APP-1001' },
    update: {},
    create: {
      id: 'APP-1001',
      first_name: 'Leonor',
      last_name: 'Rivera',
      grade_level: 8,
      type: 'New Student',
      status: 'Missing Documents',
      birth_cert: true,
      form138: false,
      good_moral: true,
      medical: false
    }
  });
  console.log('Test enrollment application seeded.');
}

seed()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
