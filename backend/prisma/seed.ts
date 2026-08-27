import { PrismaClient } from '@prisma/client';
import { generateId } from '../src/common/utils/uuid.js';

const prisma = new PrismaClient();

const PERMISSIONS = [
  // User Management
  'user:read', 'user:write',
  
  // Academic
  'academic:read', 'academic:write',
  'assignment:read_own', 'assignment:read_all', 'assignment:write',
  'enrollment:read', 'enrollment:write',

  // Grades
  'grade:read', 'grade:write', 'grade:read_all', 'grade:publish',

  // Attendance
  'attendance:read', 'attendance:write', 'attendance:write_all',

  // Documents
  'document:request', 'document:read', 'document:approve',

  // Student Services
  'clinic:read', 'clinic:write',
  'guidance:read', 'guidance:write',
  'behavior:read', 'behavior:write',

  // Admin
  'announcement:write',
  'leave:approve',
  'inventory:write',
];

const ROLES = {
  ITAdmin: PERMISSIONS, // IT Admin gets everything
  Admin: PERMISSIONS.filter(p => !['user:write'].includes(p)), // Admins get almost everything
  Principal: [
    'user:read', 'academic:read', 'assignment:read_all', 'enrollment:read',
    'grade:read_all', 'grade:publish', 'attendance:read', 'attendance:write_all',
    'document:read', 'document:approve', 'behavior:read', 'announcement:write',
    'leave:approve'
  ],
  Teacher: [
    'user:read', 'academic:read', 'assignment:read_own', 
    'grade:read', 'grade:write', 'attendance:read', 'attendance:write',
    'behavior:read', 'behavior:write'
  ],
  Student: [
    'academic:read', 'document:request', 'document:read'
  ],
  Registrar: [
    'user:read', 'academic:read', 'enrollment:read', 'enrollment:write',
    'grade:read_all', 'document:read', 'document:approve'
  ],
  Nurse: [
    'user:read', 'clinic:read', 'clinic:write'
  ],
  Guidance: [
    'user:read', 'guidance:read', 'guidance:write', 'behavior:read', 'behavior:write'
  ]
};

async function main() {
  console.log('Seeding database with Production configuration...');

  // 1. Create Permissions
  console.log('Creating permissions...');
  for (const key of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key },
      update: {},
      create: { id: generateId(), key },
    });
  }

  // 2. Create Roles and link Permissions
  console.log('Creating roles and mapping permissions...');
  for (const [roleName, rolePermissions] of Object.entries(ROLES)) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { id: generateId(), name: roleName },
    });

    // Clear existing permissions for this role to ensure strict mapping
    await prisma.rolePermission.deleteMany({
      where: { role_id: role.id },
    });

    const perms = await prisma.permission.findMany({
      where: { key: { in: rolePermissions } },
    });

    if (perms.length > 0) {
      await prisma.rolePermission.createMany({
        data: perms.map(p => ({
          role_id: role.id,
          permission_id: p.id,
        })),
        skipDuplicates: true,
      });
    }
  }

  console.log('✓ Seed completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
