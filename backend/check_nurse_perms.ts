import prisma from './src/config/database.js';

async function checkNursePermissions() {
  const role = await prisma.role.findUnique({
    where: { name: 'Nurse' },
    include: {
      role_permissions: {
        include: { permission: true }
      }
    }
  });

  if (!role) {
    console.log("Nurse role not found!");
    return;
  }

  const permNames = role.role_permissions.map(rp => rp.permission.key);
  console.log("NURSE PERMISSIONS:", JSON.stringify(permNames, null, 2));
}

checkNursePermissions().finally(() => prisma.$disconnect());
