import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log("=== CREATING BACKUP SNAPSHOT ===");
  const backupDir = 'C:\\Users\\Nhico\\backups';
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const allUsers = await prisma.user.findMany();
  const demoEmails = [
    'student@demo.com', 'teacher@demo.com', 'nurse@demo.com', 
    'principal@demo.com', 'guidance@demo.com', 'admin@demo.com', 'registrar@demo.com', 'system@internal'
  ];
  const clutterSet = allUsers.filter(u => !demoEmails.includes(u.email));
  const clutterIds = clutterSet.map(u => u.id);

  console.log(`Extracting data for ${clutterIds.length} clutter accounts...`);

  // Extract profiles
  const students = await prisma.student.findMany({ where: { user_id: { in: clutterIds } } });
  const teachers = await prisma.teacher.findMany({ where: { user_id: { in: clutterIds } } });
  const staffs = await prisma.staff.findMany({ where: { user_id: { in: clutterIds } } });

  const studentIds = students.map(s => s.id);
  const teacherIds = teachers.map(t => t.id);

  // Extract related data
  const enrollments = await prisma.enrollment.findMany({ where: { student_id: { in: studentIds } } });
  const enrollmentIds = enrollments.map(e => e.id);
  
  const grades = await prisma.grade.findMany({ where: { student_id: { in: studentIds } } });
  const classAttendances = await prisma.classAttendance.findMany({ where: { enrollment_id: { in: enrollmentIds } } });
  const appointments = await prisma.appointment.findMany({ 
    where: { OR: [{ student_id: { in: studentIds } }, { teacher_id: { in: teacherIds } }] } 
  });
  const leaveRequests = await prisma.leaveRequest.findMany({ where: { user_id: { in: clutterIds } } });
  const documentRequests = await prisma.documentRequest.findMany({ where: { student_id: { in: studentIds } } });
  const excuseLetters = await prisma.excuseLetter.findMany({ where: { student_id: { in: studentIds } } });
  const teacherSubjectAssignments = await prisma.teacherSubjectAssignment.findMany({ where: { teacher_id: { in: teacherIds } } });
  const auditLogs = await prisma.auditLog.findMany({ where: { actor_user_id: { in: clutterIds } } });
  
  const backupData = {
    users: clutterSet,
    profiles: { students, teachers, staffs },
    relations: {
      enrollments, grades, classAttendances, appointments, leaveRequests, 
      documentRequests, excuseLetters, teacherSubjectAssignments, auditLogs
    }
  };

  const backupFile = path.join(backupDir, `clutter_backup_${Date.now()}.json`);
  fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));

  console.log(`Backup saved to: ${backupFile}`);
  console.log(`File size: ${fs.statSync(backupFile).size} bytes`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
