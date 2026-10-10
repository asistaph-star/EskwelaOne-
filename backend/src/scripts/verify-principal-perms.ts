import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const role = await prisma.role.findUnique({
    where: { name: 'Principal' },
    include: { role_permissions: { include: { permission: true } } }
  });

  if (!role) {
    console.log('Principal role not found');
    return;
  }

  console.log('Principal Permissions:');
  for (const rp of role.role_permissions) {
    console.log(`- ${rp.permission.key}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
