const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const principal = await prisma.user.findFirst({
    where: { user_roles: { some: { role_name: 'Principal' } } }
  });
  console.log('Principal email:', principal ? principal.email : 'NOT FOUND');
  await prisma.$disconnect();
})();
