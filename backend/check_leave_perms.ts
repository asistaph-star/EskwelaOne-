import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const leaves = await prisma.permission.findMany({ where: { key: { contains: 'leave' } } });
  console.log("Leave permissions:");
  console.log(leaves);

  // If there is no leave:manage, let's create it.
  if (!leaves.find(l => l.key === 'leave:manage')) {
    const perm = await prisma.permission.create({
      data: {
        id: randomUUID(),
        key: 'leave:manage'
      }
    });
    console.log("Created leave:manage permission:", perm.id);

    // Give it to Principal
    const pRole = await prisma.role.findFirst({ where: { name: 'Principal' } });
    if (pRole) {
      await prisma.rolePermission.create({
        data: { role_id: pRole.id, permission_id: perm.id }
      });
      console.log("Assigned leave:manage to Principal.");
    }
  } else {
    // If it exists but we missed it, assign it.
    const perm = leaves.find(l => l.key === 'leave:manage')!;
    const pRole = await prisma.role.findFirst({ where: { name: 'Principal' } });
    if (pRole) {
      await prisma.rolePermission.upsert({
        where: { role_id_permission_id: { role_id: pRole.id, permission_id: perm.id } },
        update: {},
        create: { role_id: pRole.id, permission_id: perm.id }
      });
      console.log("Assigned existing leave:manage to Principal.");
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
