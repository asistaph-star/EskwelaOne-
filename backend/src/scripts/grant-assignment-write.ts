import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const principalRole = await prisma.role.findUnique({ where: { name: 'Principal' } });
  let perm = await prisma.permission.findUnique({ where: { key: 'assignment:write' } });
  
  if (!perm) {
    perm = await prisma.permission.create({
      data: { id: crypto.randomUUID(), key: 'assignment:write' }
    });
  }

  await prisma.rolePermission.upsert({
    where: {
      role_id_permission_id: {
        role_id: principalRole!.id,
        permission_id: perm.id
      }
    },
    update: {},
    create: {
      role_id: principalRole!.id,
      permission_id: perm.id
    }
  });

  console.log('Granted assignment:write to Principal');
}

main().catch(console.error).finally(() => prisma.$disconnect());
