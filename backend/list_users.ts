import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
prisma.user.findMany({ include: { user_roles: { include: { role: true } } } })
  .then(users => {
    users.forEach(u => {
      console.log(u.email, u.user_roles.map(r => r.role.name));
    });
  })
  .finally(() => prisma.$disconnect());
