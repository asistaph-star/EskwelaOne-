import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const p = await prisma.user.findUnique({
    where: { email: 'principal@demo.com' },
    include: {
      user_roles: {
        include: {
          role: {
            include: {
              role_permissions: {
                include: { permission: true }
              }
            }
          }
        }
      }
    }
  });
  console.log(JSON.stringify(p?.user_roles, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
