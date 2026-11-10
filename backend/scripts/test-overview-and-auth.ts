import prisma from '../src/config/database.js';

async function main() {
  const sections = await (prisma as any).section.findMany({
    where: { name: { in: ['Aguinaldo', 'Rizal'] } },
    include: { academic_year: true },
  });

  for (const sec of sections) {
    console.log(`\nSection: ${sec.name} (${sec.id})`);
  }
}

main().finally(() => prisma.$disconnect());
