import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    include: {
      user_roles: {
        include: {
          role: true
        }
      }
    }
  });

  const formatted = users.map(u => ({
    id: u.id,
    email: u.email,
    name: `${u.first_name} ${u.last_name}`,
    roles: u.user_roles.map(ur => ur.role.name).join(', ')
  }));

  console.log("--- ALL USERS IN SYSTEM ---");
  console.table(formatted);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
