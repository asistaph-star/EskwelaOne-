import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const studentRole = await prisma.role.findUnique({ where: { name: 'Student' } });
  if (!studentRole) {
    console.error("Student role not found!");
    return;
  }

  const perm = await prisma.permission.findUnique({ where: { key: 'enrollment:read' } });
  if (!perm) {
    console.error("enrollment:read permission not found!");
    return;
  }

  await prisma.rolePermission.upsert({
    where: {
      role_id_permission_id: {
        role_id: studentRole.id,
        permission_id: perm.id
      }
    },
    update: {},
    create: {
      role_id: studentRole.id,
      permission_id: perm.id
    }
  });

  console.log("Added enrollment:read permission to Student role successfully!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
