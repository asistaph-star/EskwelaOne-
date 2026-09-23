import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkRoles() {
  const roles = await prisma.role.findMany();
  console.log('Roles:', roles.map(r => r.name));

  const departments = await prisma.teacher.findMany({ select: { department: true }, distinct: ['department'] });
  console.log('Departments:', departments.map(d => d.department).filter(Boolean));

  const positions = await prisma.teacher.findMany({ select: { position: true }, distinct: ['position'] });
  console.log('Positions:', positions.map(p => p.position).filter(Boolean));
}

checkRoles().catch(console.error).finally(() => prisma.$disconnect());
