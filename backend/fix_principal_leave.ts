import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const role = await prisma.role.findFirst({ where: { name: 'Principal' } });
  if (!role) {
    console.log("No Principal role found.");
    return;
  }

  const perm = await prisma.permission.findFirst({ where: { key: 'leave:manage' } });
  if (!perm) {
    console.log("No leave:manage permission found.");
    return;
  }

  await prisma.rolePermission.upsert({
    where: {
      role_id_permission_id: {
        role_id: role.id,
        permission_id: perm.id
      }
    },
    update: {},
    create: {
      role_id: role.id,
      permission_id: perm.id
    }
  });

  console.log("Given leave:manage permission to Principal.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
