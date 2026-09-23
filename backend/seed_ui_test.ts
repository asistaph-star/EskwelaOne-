import prisma from './src/config/database.js';
import crypto from 'crypto';

async function seed() {
  const student = await prisma.student.findFirst();
  const teacher = await prisma.teacher.findFirst();
  if (!student || !teacher) return;
  
  await prisma.documentRequest.deleteMany({ where: { purpose: 'UI_VERIFICATION_TEST' } });
  
  await prisma.documentRequest.create({
    data: { 
      id: crypto.randomUUID(), 
      student_id: student.id, 
      document_type: 'Good Moral Certificate', 
      purpose: 'UI_VERIFICATION_TEST', 
      status: 'Teacher Approved', 
      current_stage: 2, 
      teacher_id: teacher.id,
      teacher_remarks: 'Verified by teacher for UI test',
      teacher_approved_date: new Date()
    }
  });
  console.log('Test Document Request Seeded');
}
seed().catch(console.error).finally(() => prisma.$disconnect());
