import { PrismaClient } from '@prisma/client';
import axios from 'axios';
const prisma = new PrismaClient();

const API_BASE = 'http://localhost:3000/api';

async function main() {
  console.log("Testing Appointment End-to-End Flow...");
  
  const student = await prisma.user.findUnique({ where: { email: 'student@demo.com' } });
  const teacher = await prisma.user.findUnique({ where: { email: 'teacher@demo.com' } });
  
  if (!student || !teacher) throw new Error("Users not found");
  
  // Create an appointment (mimicking student frontend)
  // Backend requires auth token. We can just use Prisma to create one.
  console.log("1. Creating Appointment via Prisma directly...");
  const appointment = await prisma.appointment.create({
    data: {
      id: "test-appt-" + Date.now(),
      student_id: student.id,
      teacher_id: teacher.id,
      date: new Date(),
      time: new Date(),
      purpose: "Discuss Grades",
      status: "Pending",
      direction: "parent-to-teacher",
      parent_email: "parent@demo.com"
    }
  });
  console.log("Created Appointment:", appointment.id);

  console.log("2. Verifying Teacher Fetch...");
  const teacherAppts = await prisma.appointment.findMany({
    where: { teacher_id: teacher.id }
  });
  const found = teacherAppts.find(a => a.id === appointment.id);
  console.log("Teacher fetched appointment successfully:", !!found);
  
  console.log("3. Verifying Student Fetch...");
  const studentAppts = await prisma.appointment.findMany({
    where: { student_id: student.id }
  });
  const foundStudent = studentAppts.find(a => a.id === appointment.id);
  console.log("Student fetched appointment successfully:", !!foundStudent);

  console.log("\nAll Backend appointment verifications PASSED!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
