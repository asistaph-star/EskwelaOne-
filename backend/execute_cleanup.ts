import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log("=== EXECUTING MANUAL CASCADE CLEANUP ===");

  const allUsers = await prisma.user.findMany();
  const demoEmails = [
    'student@demo.com', 'teacher@demo.com', 'nurse@demo.com', 
    'principal@demo.com', 'guidance@demo.com', 'admin@demo.com', 'registrar@demo.com', 'system@internal'
  ];
  const clutterSet = allUsers.filter(u => !demoEmails.includes(u.email));
  const clutterIds = clutterSet.map(u => u.id);

  console.log(`Starting cleanup for ${clutterIds.length} clutter accounts...`);

  // Extract profiles
  const students = await prisma.student.findMany({ where: { user_id: { in: clutterIds } } });
  const teachers = await prisma.teacher.findMany({ where: { user_id: { in: clutterIds } } });
  const staffs = await prisma.staff.findMany({ where: { user_id: { in: clutterIds } } });

  const studentIds = students.map(s => s.id);
  const teacherIds = teachers.map(t => t.id);

  // Extract enrollments
  const enrollments = await prisma.enrollment.findMany({ where: { student_id: { in: studentIds } } });
  const enrollmentIds = enrollments.map(e => e.id);

  console.log("1. Deleting deep child records...");
  await prisma.appointment.deleteMany({ where: { OR: [{ student_id: { in: studentIds } }, { teacher_id: { in: teacherIds } }] } });
  await prisma.leaveRequest.deleteMany({ where: { user_id: { in: clutterIds } } });
  await prisma.documentRequest.deleteMany({ where: { student_id: { in: studentIds } } });
  await prisma.excuseLetter.deleteMany({ where: { student_id: { in: studentIds } } });
  await prisma.clinicReferral.deleteMany({ where: { student_id: { in: studentIds } } });
  await prisma.guidanceRecord.deleteMany({ where: { student_id: { in: studentIds } } });
  
  // Grade entries (if any) created by these users or for these enrollments
  await prisma.grade_entries.deleteMany({ where: { created_by: { in: clutterIds } } });
  if (enrollmentIds.length > 0) {
    await prisma.grade_entries.deleteMany({ where: { enrollment_id: { in: enrollmentIds } } });
  }

  console.log("2. Deleting Grade and ClassAttendance records...");
  if (studentIds.length > 0) {
    await prisma.grade.deleteMany({ where: { student_id: { in: studentIds } } });
  }
  if (enrollmentIds.length > 0) {
    await prisma.classAttendance.deleteMany({ where: { enrollment_id: { in: enrollmentIds } } });
  }

  console.log("3. Deleting Enrollment records...");
  if (studentIds.length > 0) {
    await prisma.enrollment.deleteMany({ where: { student_id: { in: studentIds } } });
  }

  console.log("4. Deleting TeacherSubjectAssignment records...");
  if (teacherIds.length > 0) {
    await prisma.teacherSubjectAssignment.deleteMany({ where: { teacher_id: { in: teacherIds } } });
  }

  console.log("5. Nullifying AuditLog actor references...");
  const updatedLogs = await prisma.auditLog.updateMany({
    where: { actor_user_id: { in: clutterIds } },
    data: { actor_user_id: null }
  });
  console.log(` -> Nullified actor_user_id on ${updatedLogs.count} AuditLog records.`);

  console.log("6. Deleting Profiles...");
  if (studentIds.length > 0) await prisma.student.deleteMany({ where: { user_id: { in: clutterIds } } });
  if (teacherIds.length > 0) await prisma.teacher.deleteMany({ where: { user_id: { in: clutterIds } } });
  if (staffs.length > 0) await prisma.staff.deleteMany({ where: { user_id: { in: clutterIds } } });

  console.log("7. Deleting Users...");
  await prisma.userRole.deleteMany({ where: { user_id: { in: clutterIds } } }); // Remove many-to-many relation first
  const deletedUsers = await prisma.user.deleteMany({ where: { id: { in: clutterIds } } });
  console.log(` -> Successfully deleted ${deletedUsers.count} user rows.`);
  
  console.log("\n=== FINAL ACCOUNT INVENTORY ===");
  const finalUsers = await prisma.user.findMany({
    include: { user_roles: { include: { role: true } } }
  });
  console.log(JSON.stringify(finalUsers.map(u => ({
    id: u.id,
    email: u.email,
    roles: u.user_roles.map(ur => ur.role.name)
  })), null, 2));

  const finalLogs = await prisma.auditLog.count();
  console.log(`\nFinal AuditLog count: ${finalLogs}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
