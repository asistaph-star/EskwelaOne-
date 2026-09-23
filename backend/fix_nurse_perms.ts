import prisma from './src/config/database.js';

async function revokeNursePermissions() {
  const role = await prisma.role.findUnique({ where: { name: 'Nurse' } });
  if (!role) {
    console.log("Nurse role not found!");
    return;
  }

  const permissionsToRevoke = ['inventory:read', 'inventory:write'];

  const perms = await prisma.permission.findMany({
    where: { key: { in: permissionsToRevoke } }
  });

  if (perms.length === 0) {
    console.log("Permissions not found in DB.");
    return;
  }

  // Delete from role_permissions junction table
  const result = await prisma.rolePermission.deleteMany({
    where: {
      role_id: role.id,
      permission_id: { in: perms.map(p => p.id) }
    }
  });

  console.log(`Revoked ${result.count} permissions from Nurse.`);

  // Verify remaining permissions
  const remaining = await prisma.rolePermission.findMany({
    where: { role_id: role.id },
    include: { permission: true }
  });
  console.log("REMAINING NURSE PERMISSIONS:", JSON.stringify(remaining.map(rp => rp.permission.key), null, 2));
}

revokeNursePermissions().finally(() => prisma.$disconnect());
