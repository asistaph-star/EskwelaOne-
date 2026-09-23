import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log("=== 1. NURSE ACCOUNT DUPLICATE VERIFICATION ===");
  const nurses = await prisma.user.findMany({
    where: { email: { in: ['nurse@demo.com', 'nurse@digiskwela.test'] } },
    include: { user_roles: { include: { role: true } } }
  });
  console.log(JSON.stringify(nurses.map(n => ({
    id: n.id,
    email: n.email,
    name: `${n.first_name} ${n.last_name}`,
    roles: n.user_roles.map(ur => ur.role.name),
    created_at: n.created_at
  })), null, 2));


  console.log("\n=== 2a. FULL ACCOUNT INVENTORY AUDIT ===");
  const allUsers = await prisma.user.findMany({
    include: { user_roles: { include: { role: true } } }
  });
  console.log(JSON.stringify(allUsers.map(u => ({
    id: u.id,
    email: u.email,
    name: `${u.first_name} ${u.last_name}`,
    roles: u.user_roles.map(ur => ur.role.name),
    created_at: u.created_at
  })), null, 2));


  console.log("\n=== 2b. OFFICIAL DEMO SET ===");
  const demoEmails = [
    'student@demo.com', 'teacher@demo.com', 'nurse@demo.com', 
    'principal@demo.com', 'guidance@demo.com', 'admin@demo.com', 'registrar@demo.com', 'system@internal'
  ];
  const demoSet = allUsers.filter(u => demoEmails.includes(u.email));
  console.log(`Found ${demoSet.length} official demo/system accounts.`);
  console.log(demoSet.map(u => u.email).join(', '));


  console.log("\n=== 2c. DATA ATTACHED TO OTHER ACCOUNTS (CLUTTER) ===");
  const clutterSet = allUsers.filter(u => !demoEmails.includes(u.email));
  
  for (const user of clutterSet) {
    console.log(`\nChecking data for: ${user.email} (${user.id})`);
    
    // Profiles
    const studentProfile = await prisma.student.findFirst({ where: { user_id: user.id } });
    if (studentProfile) console.log(` - Has Student Profile (ID: ${studentProfile.id})`);
    
    const teacherProfile = await prisma.teacher.findFirst({ where: { user_id: user.id } });
    if (teacherProfile) console.log(` - Has Teacher Profile (ID: ${teacherProfile.id})`);
    
    const staffProfile = await prisma.staff.findFirst({ where: { user_id: user.id } });
    if (staffProfile) console.log(` - Has Staff Profile (ID: ${staffProfile.id})`);

    // Models linked to Student ID
    if (studentProfile) {
      const enrollments = await prisma.enrollment.count({ where: { student_id: studentProfile.id } });
      if (enrollments > 0) console.log(` - Has ${enrollments} Enrollment(s)`);
      
      const grades = await prisma.grade.count({ where: { student_id: studentProfile.id } });
      if (grades > 0) console.log(` - Has ${grades} Grade(s)`);
      // skipped ClassAttendance check for brevity

      const gateAttendance = await prisma.gateAttendance.count({ where: { student_id: studentProfile.id } });
      if (gateAttendance > 0) console.log(` - Has ${gateAttendance} Gate Attendance Record(s)`);
      
      const excuseLetters = await prisma.excuseLetter.count({ where: { student_id: studentProfile.id } });
      if (excuseLetters > 0) console.log(` - Has ${excuseLetters} Excuse Letter(s)`);

      const clinicRecords = await prisma.clinicReferral.count({ where: { student_id: studentProfile.id } });
      if (clinicRecords > 0) console.log(` - Has ${clinicRecords} Clinic Referral(s)`);

      const guidanceRecords = await prisma.guidanceRecord.count({ where: { student_id: studentProfile.id } });
      if (guidanceRecords > 0) console.log(` - Has ${guidanceRecords} Guidance Record(s)`);

      const documentRequests = await prisma.documentRequest.count({ where: { student_id: studentProfile.id } });
      if (documentRequests > 0) console.log(` - Has ${documentRequests} Document Request(s)`);
      
      const appointments = await prisma.appointment.count({ where: { student_id: studentProfile.id } });
      if (appointments > 0) console.log(` - Has ${appointments} Student Appointment(s)`);
    }

    // Models linked to Teacher ID
    if (teacherProfile) {
      const assignments = await prisma.teacherSubjectAssignment.count({ where: { teacher_id: teacherProfile.id } });
      if (assignments > 0) console.log(` - Has ${assignments} Teacher-Subject Assignment(s)`);

      const teacherAppointments = await prisma.appointment.count({ where: { teacher_id: teacherProfile.id } });
      if (teacherAppointments > 0) console.log(` - Has ${teacherAppointments} Appointment(s) as Teacher`);
    }

    // Shared / Direct User ID relations
    const leaves = await prisma.leaveRequest.count({ where: { user_id: user.id } });
    if (leaves > 0) console.log(` - Has ${leaves} Leave Request(s)`);

    const auditLogs = await prisma.auditLog.count({ where: { actor_user_id: user.id } });
    if (auditLogs > 0) console.log(` - Has ${auditLogs} Audit Log(s) as actor`);
    const events = await prisma.event.count({ where: { created_by_id: user.id } });
    if (events > 0) console.log(` - Has ${events} Event(s) created`);

    const announcements = await prisma.announcement.count({ where: { author_id: user.id } });
    if (announcements > 0) console.log(` - Has ${announcements} Announcement(s) authored`);

    console.log(` - Data check complete for ${user.email}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
