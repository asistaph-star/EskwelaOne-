import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log("=== STEP 1: Identification & Dependency Audit ===");
  const targetLrns = ['100000000001', '100000000002', '100000000003', '100000000004'];
  
  const students = await prisma.student.findMany({
    where: { lrn: { in: targetLrns } }
  });

  if (students.length === 0) {
    console.log("No seed students found. Exiting.");
    return;
  }

  const studentIds = students.map(s => s.id);
  const userIds = students.map(s => s.user_id);

  const users = await prisma.user.findMany({ where: { id: { in: userIds } } });
  const enrollments = await prisma.enrollment.findMany({ where: { student_id: { in: studentIds } } });
  const enrollmentIds = enrollments.map(e => e.id);
  const classAttendances = await prisma.classAttendance.findMany({ where: { enrollment_id: { in: enrollmentIds } } });
  const userRoles = await prisma.userRole.findMany({ where: { user_id: { in: userIds } } });

  console.log(`Found ${users.length} Users`);
  console.log(`Found ${students.length} Students`);
  console.log(`Found ${enrollments.length} Enrollments`);
  console.log(`Found ${classAttendances.length} ClassAttendance records`);
  console.log(`Found ${userRoles.length} UserRole records`);

  console.log("\n=== STEP 2: Create JSON Backup ===");
  const backup = {
    users,
    students,
    enrollments,
    classAttendances,
    userRoles
  };
  const backupPath = 'backup_seed_cleanup.json';
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
  console.log(`Backup created at ${backupPath}`);

  console.log("\n=== STEP 3: Transactional Cleanup ===");
  try {
    await prisma.$transaction(async (tx) => {
      // Deletion must happen in dependency order from leaves to root
      console.log("Deleting ClassAttendances...");
      const deletedAtt = await tx.classAttendance.deleteMany({ where: { enrollment_id: { in: enrollmentIds } } });
      
      console.log("Deleting Enrollments...");
      const deletedEnr = await tx.enrollment.deleteMany({ where: { student_id: { in: studentIds } } });
      
      console.log("Deleting Students...");
      const deletedStu = await tx.student.deleteMany({ where: { id: { in: studentIds } } });
      
      console.log("Deleting UserRoles (if any)...");
      const deletedUR = await tx.userRole.deleteMany({ where: { user_id: { in: userIds } } });
      
      console.log("Deleting Users...");
      const deletedUsr = await tx.user.deleteMany({ where: { id: { in: userIds } } });

      console.log(`\nRecords removed in transaction:`);
      console.log(`- ${deletedAtt.count} ClassAttendance records`);
      console.log(`- ${deletedEnr.count} Enrollments`);
      console.log(`- ${deletedStu.count} Students`);
      console.log(`- ${deletedUR.count} UserRoles`);
      console.log(`- ${deletedUsr.count} Users`);
    });
    console.log("Transaction committed successfully.");
  } catch (error) {
    console.error("Transaction failed, rolled back.", error);
    return;
  }

  console.log("\n=== STEP 4: Verification ===");
  const vStudents = await prisma.student.findMany({ where: { lrn: { in: targetLrns } } });
  const vUsers = await prisma.user.findMany({ where: { id: { in: userIds } } });
  console.log(`Verification - Students remaining: ${vStudents.length}`);
  console.log(`Verification - Users remaining: ${vUsers.length}`);

}

main().catch(console.error).finally(() => prisma.$disconnect());
