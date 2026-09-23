import { PrismaClient } from '@prisma/client'; const prisma = new PrismaClient(); prisma.guidanceRecord.findMany().then(r => console.log(r)).catch(console.error).finally(() => prisma.$disconnect());
