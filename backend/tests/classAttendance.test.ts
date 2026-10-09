import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/database.js';
import { generateId } from '../src/common/utils/uuid.js';
import { sign } from 'jsonwebtoken';
import { config } from '../src/config/env.js';

describe('Phase 4P: Class Attendance Characterization Tests', () => {
  let adminToken: string;
  let teacherAToken: string;
  let teacherBToken: string;
  let studentAToken: string;
  let studentBToken: string;

  let teacherAUserId: string;
  let adminUserId: string;
  
  let sectionId: string;
  let academicYearId: string;
  let classId: string; // Assignment ID for Teacher A
  let otherClassId: string; // Assignment ID for Teacher B
  
  let studentAId: string;
  let studentBId: string;
  let enrollmentAId: string;
  let enrollmentBId: string;

  beforeAll(async () => {
    const createUser = async (email: string, roles: string[], permissions: string[] = []) => {
      const user = await prisma.user.create({
        data: {
          id: generateId(),
          email,
          password_hash: 'hash',
          first_name: 'Test',
          last_name: 'User'
        }
      });
      
      for (const roleName of roles) {
        let role = await prisma.role.findFirst({ where: { name: roleName } });
        if (!role) role = await prisma.role.create({ data: { id: generateId(), name: roleName } });
        await prisma.userRole.create({ data: { user_id: user.id, role_id: role.id } });

        // Add permissions to role
        for (const p of permissions) {
          let perm = await prisma.permission.findFirst({ where: { key: p } });
          if (!perm) perm = await prisma.permission.create({ data: { id: generateId(), key: p } });
          
          const existingRP = await prisma.rolePermission.findFirst({ where: { role_id: role.id, permission_id: perm.id } });
          if (!existingRP) {
            await prisma.rolePermission.create({ data: { role_id: role.id, permission_id: perm.id } });
          }
        }
      }

      const token = sign(
        { userId: user.id, email: user.email, roles, permissions },
        config.jwt.secret,
        { expiresIn: '1h' }
      );
      return { user, token };
    };

    const ts = Date.now();
    
    // Create Users
    const admin = await createUser(`admin-${ts}@test.com`, ['Admin'], ['attendance:read_all', 'attendance:write_all', 'attendance:read', 'attendance:write']);
    const teacherA = await createUser(`teacherA-${ts}@test.com`, ['Teacher'], ['attendance:read', 'attendance:write']);
    const teacherB = await createUser(`teacherB-${ts}@test.com`, ['Teacher'], ['attendance:read', 'attendance:write']);
    const studentA = await createUser(`studentA-${ts}@test.com`, ['Student']);
    const studentB = await createUser(`studentB-${ts}@test.com`, ['Student']);

    adminToken = admin.token;
    teacherAToken = teacherA.token;
    teacherBToken = teacherB.token;
    studentAToken = studentA.token;
    studentBToken = studentB.token;

    teacherAUserId = teacherA.user.id;
    adminUserId = admin.user.id;

    // Profiles
    const tA = await prisma.teacher.create({ data: { id: generateId(), user_id: teacherA.user.id, specialization: 'Math', employee_id: `EMP-${ts}-A` } });
    const tB = await prisma.teacher.create({ data: { id: generateId(), user_id: teacherB.user.id, specialization: 'Sci', employee_id: `EMP-${ts}-B` } });
    
    const sA = await prisma.student.create({ data: { id: generateId(), user_id: studentA.user.id, lrn: `LRN-${ts}-A`, grade_level: 10 } });
    studentAId = sA.id;
    const sB = await prisma.student.create({ data: { id: generateId(), user_id: studentB.user.id, lrn: `LRN-${ts}-B`, grade_level: 10 } });
    studentBId = sB.id;

    // Academic Year & Section
    let ay = await prisma.academicYear.findFirst({ where: { is_current: true } });
    if (!ay) {
      ay = await prisma.academicYear.create({ data: { id: generateId(), name: `AY-${ts}`, start_date: new Date(), end_date: new Date(), is_current: true } });
    }
    academicYearId = ay.id;

    const section = await prisma.section.create({ data: { id: generateId(), name: `Sec-${ts}`, grade_level: 10, academic_year_id: ay.id } });
    sectionId = section.id;

    // Subjects & Assignments
    const subMath = await prisma.subject.create({ data: { id: generateId(), name: `Math-${ts}`, code: `MTH-${ts}` } });
    const assignA = await prisma.teacherSubjectAssignment.create({
      data: { id: generateId(), teacher_id: tA.id, section_id: section.id, subject_id: subMath.id, academic_year_id: ay.id }
    });
    classId = assignA.id;

    const subSci = await prisma.subject.create({ data: { id: generateId(), name: `Sci-${ts}`, code: `SCI-${ts}` } });
    const assignB = await prisma.teacherSubjectAssignment.create({
      data: { id: generateId(), teacher_id: tB.id, section_id: section.id, subject_id: subSci.id, academic_year_id: ay.id }
    });
    otherClassId = assignB.id;

    // Enrollments
    const enA = await prisma.enrollment.create({
      data: { id: generateId(), student_id: sA.id, section_id: section.id, academic_year_id: ay.id, status: 'Enrolled' }
    });
    enrollmentAId = enA.id;

    const enB = await prisma.enrollment.create({
      data: { id: generateId(), student_id: sB.id, section_id: section.id, academic_year_id: ay.id, status: 'Enrolled' }
    });
    enrollmentBId = enB.id;

  });

  afterAll(async () => {
    // Cleanup
    const testUsers = await prisma.user.findMany({ where: { email: { contains: 'test.com' } }, select: { id: true } });
    const testUserIds = testUsers.map(u => u.id);

    await prisma.classAttendance.deleteMany({
      where: { enrollment: { section: { name: { contains: 'Sec-' } } } }
    });
    await prisma.enrollment.deleteMany({ where: { section: { name: { contains: 'Sec-' } } } });
    await prisma.teacherSubjectAssignment.deleteMany({ where: { section: { name: { contains: 'Sec-' } } } });
    
    await prisma.student.updateMany({
      where: { current_section_id: sectionId },
      data: { current_section_id: null }
    });
    
    if (testUserIds.length > 0) {
      await prisma.auditLog.deleteMany({ where: { actor_user_id: { in: testUserIds } } });
    }

    await prisma.student.deleteMany({ where: { user: { email: { contains: 'test.com' } } } });
    await prisma.teacher.deleteMany({ where: { user: { email: { contains: 'test.com' } } } });
    await prisma.section.deleteMany({ where: { name: { contains: 'Sec-' } } });
    
    // We didn't save subject IDs, let's delete subjects matching test.com pattern... wait we named them Math-${ts}
    await prisma.subject.deleteMany({ where: { name: { contains: '-' } } }); 

    await prisma.userRole.deleteMany({ where: { user: { email: { contains: 'test.com' } } } });
    await prisma.user.deleteMany({ where: { email: { contains: 'test.com' } } });
  });

  describe('1. Class Roster Access', () => {
    it('should allow assigned teacher to fetch roster', async () => {
      const res = await request(app)
        .get(`/api/attendance/classes/${classId}/roster`)
        .set('Authorization', `Bearer ${teacherAToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
    });

    it('should deny unassigned teacher from fetching roster', async () => {
      const res = await request(app)
        .get(`/api/attendance/classes/${classId}/roster`)
        .set('Authorization', `Bearer ${teacherBToken}`);
      expect(res.status).toBe(403);
    });

    it('should allow admin to fetch roster', async () => {
      const res = await request(app)
        .get(`/api/attendance/classes/${classId}/roster`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    });
  });

  describe('2. Single Attendance Record (POST /api/attendance/class)', () => {
    it('should allow assigned teacher to record attendance', async () => {
      const res = await request(app)
        .post(`/api/attendance/class`)
        .set('Authorization', `Bearer ${teacherAToken}`)
        .send({
          teacherSubjectAssignmentId: classId,
          studentEnrollmentId: enrollmentAId,
          date: '2026-10-15',
          status: 'P'
        });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('P');
    });

    it('should deny unassigned teacher from recording attendance', async () => {
      const res = await request(app)
        .post(`/api/attendance/class`)
        .set('Authorization', `Bearer ${teacherBToken}`)
        .send({
          teacherSubjectAssignmentId: classId,
          studentEnrollmentId: enrollmentAId,
          date: '2026-10-15',
          status: 'P'
        });
      expect(res.status).toBe(403);
    });

    it('should deny recording for student not in class section', async () => {
      // Simulate invalid enrollment (just a random ID)
      const res = await request(app)
        .post(`/api/attendance/class`)
        .set('Authorization', `Bearer ${teacherAToken}`)
        .send({
          teacherSubjectAssignmentId: classId,
          studentEnrollmentId: generateId(),
          date: '2026-10-15',
          status: 'P'
        });
      expect(res.status).toBe(400); // Invalid enrollment
    });
  });

  describe('3. Bulk Attendance (POST /api/attendance/classes/:classId/records/bulk)', () => {
    it('should allow assigned teacher to bulk insert', async () => {
      const res = await request(app)
        .post(`/api/attendance/classes/${classId}/records/bulk`)
        .set('Authorization', `Bearer ${teacherAToken}`)
        .send({
          records: [
            { studentEnrollmentId: enrollmentAId, date: '2026-10-16', status: 'P' },
            { studentEnrollmentId: enrollmentBId, date: '2026-10-16', status: 'A' }
          ]
        });
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(2);
    });

    it('should deny bulk insert with invalid enrollment in batch', async () => {
      const res = await request(app)
        .post(`/api/attendance/classes/${classId}/records/bulk`)
        .set('Authorization', `Bearer ${teacherAToken}`)
        .send({
          records: [
            { studentEnrollmentId: enrollmentAId, date: '2026-10-17', status: 'P' },
            { studentEnrollmentId: generateId(), date: '2026-10-17', status: 'A' }
          ]
        });
      expect(res.status).toBe(400);
    });
  });

  describe('4. Read Attendance Records', () => {
    it('should allow assigned teacher to read class records', async () => {
      const res = await request(app)
        .get(`/api/attendance/classes/${classId}/records`)
        .set('Authorization', `Bearer ${teacherAToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('should deny unassigned teacher from reading class records', async () => {
      const res = await request(app)
        .get(`/api/attendance/classes/${classId}/records`)
        .set('Authorization', `Bearer ${teacherBToken}`);
      expect(res.status).toBe(403);
    });

    it('should allow student to read their own records', async () => {
      const res = await request(app)
        .get(`/api/attendance/class/${studentAId}`)
        .set('Authorization', `Bearer ${studentAToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.every((r: any) => r.assignment !== undefined)).toBe(true);
    });

    it('should deny student from reading another student records', async () => {
      const res = await request(app)
        .get(`/api/attendance/class/${studentBId}`)
        .set('Authorization', `Bearer ${studentAToken}`);
      expect(res.status).toBe(403);
    });
  });
});
