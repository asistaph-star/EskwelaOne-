import prisma from './src/config/database.js';

async function executeRevocations() {
  const revocations: Record<string, string[]> = {
    'Admin': ['clinic:write', 'guidance:write', 'grade:write', 'grade:publish', 'assignment:write', 'attendance:write'],
    'ITAdmin': ['clinic:write', 'guidance:write', 'grade:write', 'grade:publish', 'assignment:write', 'attendance:write'],
    'Registrar': ['assignment:write']
  };

  console.log("=== EXECUTING PERMISSION REVOCATIONS ===\n");

  for (const [roleName, permsToRevoke] of Object.entries(revocations)) {
    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) {
      console.log(`Role ${roleName} not found!`);
      continue;
    }

    const perms = await prisma.permission.findMany({
      where: { key: { in: permsToRevoke } }
    });

    if (perms.length > 0) {
      const res = await prisma.rolePermission.deleteMany({
        where: {
          role_id: role.id,
          permission_id: { in: perms.map(p => p.id) }
        }
      });
      console.log(`Revoked ${res.count} permissions from ${roleName}.`);
    } else {
      console.log(`No matching permissions found to revoke for ${roleName}.`);
    }
  }

  console.log("\n=== POST-EXECUTION VERIFICATION ===");
  const rolesToVerify = ['Admin', 'ITAdmin', 'Registrar'];
  const roles = await prisma.role.findMany({
    where: { name: { in: rolesToVerify } },
    include: { role_permissions: { include: { permission: true } } }
  });

  for (const role of roles) {
    const currentPerms = role.role_permissions.map(rp => rp.permission.key).sort();
    console.log(`\nRole: ${role.name} (${currentPerms.length} perms)`);
    console.log(currentPerms.join(', '));
  }
}

executeRevocations().catch(console.error).finally(() => prisma.$disconnect());
