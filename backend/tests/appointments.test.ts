import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import prisma from '../src/config/database';
import bcrypt from 'bcrypt';
import { generateId } from '../src/common/utils/uuid';
import { sign } from 'jsonwebtoken';
import { config } from '../src/config/env';

const TEST_PASSWORD = 'Password123!';

let teacherUserId: string;
let teacherToken: string;
let teacherId: string;

let studentUserId: string;
let studentToken: string;
let studentId: string;

let guidanceUserId: string;
let guidanceToken: string;
let staffId: string;

let appointmentId: string;

describe('Phase 4B: Appointments Characterization Tests', () => {
  beforeAll(async () => {
    // Cleanup any orphaned records from failed runs
    try {
      const orphanedUsers = await prisma.user.findMany({
        where: { email: { in: ['teacher_appt@calulut.edu.ph', 'student_appt@calulut.edu.ph', 'guidance_appt@calulut.edu.ph'] } }
      });
      if (orphanedUsers.length > 0) {
        const uids = orphanedUsers.map(u => u.id);
        await prisma.userRole.deleteMany({ where: { user_id: { in: uids } } });
        await prisma.auditLog.deleteMany({ where: { actor_user_id: { in: uids } } });
        await prisma.teacher.deleteMany({ where: { user_id: { in: uids } } });
        await prisma.student.deleteMany({ where: { user_id: { in: uids } } });
        await prisma.staff.deleteMany({ where: { user_id: { in: uids } } });
        await prisma.user.deleteMany({ where: { id: { in: uids } } });
      }
    } catch(err) {}

    const password_hash = await bcrypt.hash(TEST_PASSWORD, 10);
    
    // Create Roles
    let teacherRole = await prisma.role.findFirst({ where: { name: 'Teacher' } });
    if (!teacherRole) teacherRole = await prisma.role.create({ data: { id: generateId(), name: 'Teacher' } });
    
    let studentRole = await prisma.role.findFirst({ where: { name: 'Student' } });
    if (!studentRole) studentRole = await prisma.role.create({ data: { id: generateId(), name: 'Student' } });
    
    let guidanceRole = await prisma.role.findFirst({ where: { name: 'Guidance' } });
    if (!guidanceRole) guidanceRole = await prisma.role.create({ data: { id: generateId(), name: 'Guidance' } });

    // 1. Create Teacher
    teacherUserId = generateId();
    teacherId = generateId();
    await prisma.user.create({
      data: {
        id: teacherUserId, email: 'teacher_appt@calulut.edu.ph', password_hash, first_name: 'Teacher', last_name: 'Appt', status: 'active', must_change_password: false,
        user_roles: { create: { role_id: teacherRole.id } },
        teacher: { create: { id: teacherId, employee_id: 'T-APPT-1', department: 'Science' } }
      }
    });
    teacherToken = sign({ userId: teacherUserId }, config.jwt.secret, { expiresIn: '1h' });

    // 2. Create Student
    studentUserId = generateId();
    studentId = generateId();
    await prisma.user.create({
      data: {
        id: studentUserId, email: 'student_appt@calulut.edu.ph', password_hash, first_name: 'Student', last_name: 'Appt', status: 'active', must_change_password: false,
        user_roles: { create: { role_id: studentRole.id } },
        student: { create: { id: studentId, lrn: '987654321098', grade_level: 10 } }
      }
    });
    studentToken = sign({ userId: studentUserId }, config.jwt.secret, { expiresIn: '1h' });

    // 3. Create Guidance
    guidanceUserId = generateId();
    staffId = generateId();
    await prisma.user.create({
      data: {
        id: guidanceUserId, email: 'guidance_appt@calulut.edu.ph', password_hash, first_name: 'Guidance', last_name: 'Appt', status: 'active', must_change_password: false,
        user_roles: { create: { role_id: guidanceRole.id } },
        staff: { create: { id: staffId, employee_id: 'G-APPT-1', position: 'Counselor', department: 'Guidance' } }
      }
    });
    guidanceToken = sign({ userId: guidanceUserId }, config.jwt.secret, { expiresIn: '1h' });
  });

  afterAll(async () => {
    // Cleanup
    if (studentId) await prisma.appointment.deleteMany({ where: { student_id: studentId } });
    const userIds = [teacherUserId, studentUserId, guidanceUserId].filter(Boolean) as string[];
    if (userIds.length > 0) {
      await prisma.userRole.deleteMany({ where: { user_id: { in: userIds } } });
      await prisma.auditLog.deleteMany({ where: { actor_user_id: { in: userIds } } });
      if (teacherUserId) await prisma.teacher.deleteMany({ where: { user_id: teacherUserId } });
      if (studentUserId) await prisma.student.deleteMany({ where: { user_id: studentUserId } });
      if (guidanceUserId) await prisma.staff.deleteMany({ where: { user_id: guidanceUserId } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await prisma.$disconnect();
  });

  describe('POST /api/student-services/appointments', () => {
    it('Student can create an appointment with a Guidance Counselor', async () => {
      const res = await request(app)
        .post('/api/student-services/appointments')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          staffId: staffId, // Resolves to counselor-to-parent direction if student requests? Wait, let's see.
          date: '2026-12-01',
          time: '10:00',
          purpose: 'Discuss academic stress',
          parentEmail: 'parent@test.com'
        });
      
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.direction).toBe('parent-to-counselor');
      expect(res.body.data.student_id).toBe(studentId);
      expect(res.body.data.staff_id).toBe(staffId);
      expect(res.body.data.teacher_id).toBeNull();
      
      appointmentId = res.body.data.id;
    });

    it('Student cannot create an appointment without teacherId or staffId', async () => {
      const res = await request(app)
        .post('/api/student-services/appointments')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          date: '2026-12-01',
          time: '10:00',
          purpose: 'Missing staff',
        });
      
      expect(res.status).toBe(400); // Because neither is provided
    });

    it('Teacher cannot create appointment if student is not assigned (Forbidden)', async () => {
      const res = await request(app)
        .post('/api/student-services/appointments')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          studentId: studentId,
          date: '2026-12-02',
          time: '14:00',
          purpose: 'Teacher initiated',
        });
      
      // We expect 403 because student is not assigned to teacher in TeacherSubjectAssignment
      expect(res.status).toBe(403);
    });

    it('Guidance can create an appointment with any student', async () => {
      const res = await request(app)
        .post('/api/student-services/appointments')
        .set('Authorization', `Bearer ${guidanceToken}`)
        .send({
          studentId: studentId,
          date: '2026-12-03',
          time: '11:00',
          purpose: 'Guidance initiated',
        });
      
      expect(res.status).toBe(201);
      expect(res.body.data.direction).toBe('counselor-to-parent');
    });
  });

  describe('GET /api/student-services/appointments/me', () => {
    it('Guidance should see their appointments', async () => {
      const res = await request(app)
        .get('/api/student-services/appointments/me')
        .set('Authorization', `Bearer ${guidanceToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1); // the ones we created
      expect(res.body.data[0].staff_id).toBe(staffId);
    });

    it('Student should be forbidden from /me', async () => {
      const res = await request(app)
        .get('/api/student-services/appointments/me')
        .set('Authorization', `Bearer ${studentToken}`);
      
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/student-services/appointments/:studentId', () => {
    it('Student can fetch their own appointments', async () => {
      const res = await request(app)
        .get(`/api/student-services/appointments/${studentId}`)
        .set('Authorization', `Bearer ${studentToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('Student gets 403 if fetching another student appointments', async () => {
      const res = await request(app)
        .get(`/api/student-services/appointments/some-other-id`)
        .set('Authorization', `Bearer ${studentToken}`);
      
      expect(res.status).toBe(403);
    });
  });

  describe('PATCH /api/student-services/appointments/:id/status', () => {
    it('Guidance can update the status of their appointment', async () => {
      const res = await request(app)
        .patch(`/api/student-services/appointments/${appointmentId}/status`)
        .set('Authorization', `Bearer ${guidanceToken}`)
        .send({ status: 'Approved' });
      
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('Approved');
    });

    it('Teacher gets 403 trying to update Guidance appointment', async () => {
      const res = await request(app)
        .patch(`/api/student-services/appointments/${appointmentId}/status`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ status: 'Rejected' });
      
      expect(res.status).toBe(403);
    });
  });

  describe('Audit Log Side Effect', () => {
    it('Should have created an audit log for the appointment creation', async () => {
      const logs = await prisma.auditLog.findMany({
        where: { resource_id: appointmentId, action: 'APPOINTMENT_CREATED' }
      });
      expect(logs.length).toBe(1);
    });
  });
});
