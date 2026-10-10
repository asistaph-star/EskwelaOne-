import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const pRole = await prisma.role.findFirst({
    where: { name: 'Principal' },
    include: {
      role_permissions: {
        include: { permission: true }
      }
    }
  });
  
  if (!pRole) {
    console.log("No Principal role found");
    return;
  }
  
  const perms = pRole.role_permissions.map(rp => rp.permission.key);
  console.log("Principal user:read ->", perms.includes("user:read") ? "YES" : "NO");
  console.log("Principal user:write ->", perms.includes("user:write") ? "YES" : "NO");
  console.log("Principal assignment:write ->", perms.includes("assignment:write") ? "YES" : "NO");
  
  await prisma.$disconnect();
}
main().catch(console.error);
