import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.findFirst({
    where: { email: 'admin@demo.com' },
    include: { user_roles: { include: { role: { include: { role_permissions: { include: { permission: true } } } } } } }
  });
  console.log('Admin Permissions:', admin?.user_roles.flatMap(ur => ur.role.role_permissions.map(rp => rp.permission.key)));
}
main().finally(() => prisma.$disconnect());
