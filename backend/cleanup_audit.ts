import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log("=== ACCOUNT CLEANUP & DEEP AUDIT ===");

  const allUsers = await prisma.user.findMany({
    include: { user_roles: { include: { role: true } } }
  });

  const demoEmails = [
    'student@demo.com', 'teacher@demo.com', 'nurse@demo.com', 
    'principal@demo.com', 'guidance@demo.com', 'admin@demo.com', 'registrar@demo.com', 'system@internal'
  ];
  
  const clutterSet = allUsers.filter(u => !demoEmails.includes(u.email));

  console.log(`Found ${clutterSet.length} clutter accounts to analyze.\n`);

  for (const user of clutterSet) {
    console.log(`--------------------------------------------------`);
    console.log(`Analyzing: ${user.email} (ID: ${user.id})`);
    
    let totalAttached = 0;
    const attachments: string[] = [];
    
    // Profiles
    const studentProfile = await prisma.student.findFirst({ where: { user_id: user.id } });
    if (studentProfile) { attachments.push(`Student Profile (ID: ${studentProfile.id})`); totalAttached++; }
    
    const teacherProfile = await prisma.teacher.findFirst({ where: { user_id: user.id } });
    if (teacherProfile) { attachments.push(`Teacher Profile (ID: ${teacherProfile.id})`); totalAttached++; }
    
    const staffProfile = await prisma.staff.findFirst({ where: { user_id: user.id } });
    if (staffProfile) { attachments.push(`Staff Profile (ID: ${staffProfile.id})`); totalAttached++; }

    // Models linked to Student ID
    if (studentProfile) {
      const enrollments = await prisma.enrollment.count({ where: { student_id: studentProfile.id } });
      if (enrollments > 0) { attachments.push(`${enrollments} Enrollment(s)`); totalAttached += enrollments; }
      
      const grades = await prisma.grade.count({ where: { student_id: studentProfile.id } });
      if (grades > 0) { attachments.push(`${grades} Grade(s)`); totalAttached += grades; }
      
      const gateAttendance = await prisma.gateAttendance.count({ where: { student_id: studentProfile.id } });
      if (gateAttendance > 0) { attachments.push(`${gateAttendance} Gate Attendance Record(s)`); totalAttached += gateAttendance; }
      
      const excuseLetters = await prisma.excuseLetter.count({ where: { student_id: studentProfile.id } });
      if (excuseLetters > 0) { attachments.push(`${excuseLetters} Excuse Letter(s)`); totalAttached += excuseLetters; }

      const clinicRecords = await prisma.clinicReferral.count({ where: { student_id: studentProfile.id } });
      if (clinicRecords > 0) { attachments.push(`${clinicRecords} Clinic Referral(s)`); totalAttached += clinicRecords; }

      const guidanceRecords = await prisma.guidanceRecord.count({ where: { student_id: studentProfile.id } });
      if (guidanceRecords > 0) { attachments.push(`${guidanceRecords} Guidance Record(s)`); totalAttached += guidanceRecords; }

      const documentRequests = await prisma.documentRequest.count({ where: { student_id: studentProfile.id } });
      if (documentRequests > 0) { attachments.push(`${documentRequests} Document Request(s)`); totalAttached += documentRequests; }
      
      const appointments = await prisma.appointment.count({ where: { student_id: studentProfile.id } });
      if (appointments > 0) { attachments.push(`${appointments} Student Appointment(s)`); totalAttached += appointments; }
    }

    // Models linked to Teacher ID
    if (teacherProfile) {
      const assignments = await prisma.teacherSubjectAssignment.count({ where: { teacher_id: teacherProfile.id } });
      if (assignments > 0) { attachments.push(`${assignments} Teacher-Subject Assignment(s)`); totalAttached += assignments; }

      const teacherAppointments = await prisma.appointment.count({ where: { teacher_id: teacherProfile.id } });
      if (teacherAppointments > 0) { attachments.push(`${teacherAppointments} Appointment(s) as Teacher`); totalAttached += teacherAppointments; }
    }

    // Shared / Direct User ID relations
    const leaves = await prisma.leaveRequest.count({ where: { user_id: user.id } });
    if (leaves > 0) { attachments.push(`${leaves} Leave Request(s)`); totalAttached += leaves; }

    const auditLogs = await prisma.auditLog.count({ where: { actor_user_id: user.id } });
    if (auditLogs > 0) { attachments.push(`${auditLogs} Audit Log(s) as actor`); totalAttached += auditLogs; }
    
    const events = await prisma.event.count({ where: { created_by_id: user.id } });
    if (events > 0) { attachments.push(`${events} Event(s) created`); totalAttached += events; }

    const announcements = await prisma.announcement.count({ where: { author_id: user.id } });
    if (announcements > 0) { attachments.push(`${announcements} Announcement(s) authored`); totalAttached += announcements; }

    // Report
    if (totalAttached === 0) {
      console.log(`[STATUS] Orphan Account (0 attachments). Attempting safe deletion...`);
      try {
        await prisma.user.delete({ where: { id: user.id } });
        console.log(`[RESULT] SUCCESS - Deleted ${user.email}`);
      } catch (e: any) {
        console.log(`[RESULT] FAILED - Deletion rejected: ${e.message}`);
      }
    } else {
      console.log(`[STATUS] Has ${totalAttached} attached record(s). Blocked by Restrict constraint. Skipping deletion.`);
      console.log(`[ATTACHMENTS]`);
      attachments.forEach(a => console.log(`  - ${a}`));
    }
  }

  console.log(`\n=== FINAL INVENTORY (Post Cleanup) ===`);
  const finalUsers = await prisma.user.findMany({
    include: { user_roles: { include: { role: true } } }
  });
  
  const finalDemo = finalUsers.filter(u => demoEmails.includes(u.email));
  const finalClutter = finalUsers.filter(u => !demoEmails.includes(u.email));
  
  console.log(`Official Demo Set: ${finalDemo.length} remaining`);
  console.log(`Leftover Clutter: ${finalClutter.length} remaining`);
  
  if (finalClutter.length > 0) {
    console.log(`\nThe following clutter accounts require manual cascade cleanup:`);
    finalClutter.forEach(u => console.log(` - ${u.email} (${u.id})`));
  } else {
    console.log(`\nALL CLUTTER ACCOUNTS REMOVED SUCCESSFULLY.`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
