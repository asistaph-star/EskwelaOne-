import prisma from './src/config/database.js';

async function main() {
  const users = await prisma.user.findMany({
    where: { status: 'active' },
    include: { user_roles: { include: { role: true } } }
  });

  const nurses = users.filter(u => u.user_roles.some(ur => ur.role.name === 'Nurse' || ur.role.name === 'Clinic Staff'));
  console.log(`Nurses found: ${nurses.length}`);
  if (nurses.length > 0) {
    console.log(`Nurse email: ${nurses[0].email}`);
  }
}

main().finally(() => prisma.$disconnect());
