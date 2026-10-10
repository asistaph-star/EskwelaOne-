import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/database.js';
import { generateId } from '../src/common/utils/uuid.js';
import { sign } from 'jsonwebtoken';
import { config } from '../src/config/env.js';

describe('Phase 4O: Excuse Letters Characterization Tests', () => {
  let studentAToken: string;
  let studentBToken: string;
  let teacherAToken: string;
  let teacherBToken: string;
  
  let studentAId: string;
  let studentBId: string;
  let teacherAId: string;
  let teacherBId: string;

  let studentAUserId: string;
  let studentBUserId: string;
  let teacherAUserId: string;
  let teacherBUserId: string;

  let validSectionId: string;
  let academicYearId: string;
  let subjectId: string;
  
  let createdExcuseLetterId: string;

  beforeAll(async () => {
    // Helper to create users and tokens
    const createUser = async (email: string, roles: string[]) => {
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
      }

      const token = sign(
        { userId: user.id, email: user.email, roles },
        config.jwt.secret,
        { expiresIn: '1h' }
      );
      return { user, token };
    };

    const ts = Date.now();
    const studentA = await createUser(`studentA-${ts}@test.com`, ['Student']);
    const studentB = await createUser(`studentB-${ts}@test.com`, ['Student']);
    const teacherA = await createUser(`teacherA-${ts}@test.com`, ['Teacher']);
    const teacherB = await createUser(`teacherB-${ts}@test.com`, ['Teacher']);

    studentAToken = studentA.token;
    studentBToken = studentB.token;
    teacherAToken = teacherA.token;
    teacherBToken = teacherB.token;

    studentAUserId = studentA.user.id;
    studentBUserId = studentB.user.id;
    teacherAUserId = teacherA.user.id;
    teacherBUserId = teacherB.user.id;

    // Profiles
    const sA = await prisma.student.create({ data: { id: generateId(), user_id: studentA.user.id, lrn: `LRN-${ts}-A`, grade_level: 10 } });
    studentAId = sA.id;
    const sB = await prisma.student.create({ data: { id: generateId(), user_id: studentB.user.id, lrn: `LRN-${ts}-B`, grade_level: 10 } });
    studentBId = sB.id;
    
    const tA = await prisma.teacher.create({ data: { id: generateId(), user_id: teacherA.user.id, specialization: 'Math', employee_id: `EMP-${ts}-A` } });
    teacherAId = tA.id;
    const tB = await prisma.teacher.create({ data: { id: generateId(), user_id: teacherB.user.id, specialization: 'Science', employee_id: `EMP-${ts}-B` } });
    teacherBId = tB.id;

    // Find or Create Academic Year
    let ay = await prisma.academicYear.findFirst({ where: { is_current: true } });
    if (!ay) {
      ay = await prisma.academicYear.create({
        data: {
          id: generateId(),
          name: `AY 2099-2100`,
          start_date: new Date(),
          end_date: new Date(),
          is_current: true
        }
      });
      academicYearId = ay.id; // Only clean up if we created it
    } else {
      academicYearId = ay.id;
    }

    // Create Section
    const section = await prisma.section.create({
      data: {
        id: generateId(),
        name: `Section A-${ts}`,
        grade_level: 10,
        academic_year_id: ay.id
      }
    });
    validSectionId = section.id;

    // Create Subject
    const subject = await prisma.subject.create({
      data: {
        id: generateId(),
        name: `Math-${ts}`,
        code: `MTH-${ts}`
      }
    });
    subjectId = subject.id;

    // Assign Teacher A to Section
    await prisma.teacherSubjectAssignment.create({
      data: {
        id: generateId(),
        teacher_id: teacherAId,
        section_id: section.id,
        subject_id: subject.id,
        academic_year_id: ay.id
      }
    });

    // Enroll Student A in Section
    await prisma.enrollment.create({
      data: {
        id: generateId(),
        student_id: studentAId,
        section_id: section.id,
        academic_year_id: ay.id,
        status: 'Enrolled'
      }
    });

    // Create a preexisting excuse letter for Student B, assigned to Teacher B
    await prisma.excuseLetter.create({
      data: {
        id: generateId(),
        student_id: studentBId,
        teacher_id: teacherBId,
        reason: 'Existing excuse',
        start_date: new Date(),
        end_date: new Date(),
        status: 'Pending Review'
      }
    });
  });

  afterAll(async () => {
    const sIds = [studentAId, studentBId].filter(Boolean);
    const tIds = [teacherAId, teacherBId].filter(Boolean);
    const userIds = [studentAUserId, studentBUserId, teacherAUserId, teacherBUserId].filter(Boolean);

    await prisma.excuseLetter.deleteMany({
      where: { OR: [ { student_id: { in: sIds } }, { teacher_id: { in: tIds } } ] }
    });
    await prisma.enrollment.deleteMany({ where: { student_id: { in: sIds } } });
    await prisma.teacherSubjectAssignment.deleteMany({ where: { teacher_id: { in: tIds } } });
    
    // Clear section references before deletion
    await prisma.student.updateMany({
      where: { current_section_id: validSectionId },
      data: { current_section_id: null }
    });

    // Find all leaked test users to clean up their audit logs
    const testUsers = await prisma.user.findMany({ where: { email: { contains: 'test.com' } }, select: { id: true } });
    const testUserIds = testUsers.map(u => u.id);

    // Delete Audit Logs
    if (testUserIds.length > 0) {
      await prisma.auditLog.deleteMany({
        where: { actor_user_id: { in: testUserIds } }
      });
    }

    // Delete students and teachers BEFORE section/academic_year to satisfy FK constraints
    await prisma.student.deleteMany({ where: { user: { email: { contains: 'test.com' } } } });
    await prisma.teacher.deleteMany({ where: { user: { email: { contains: 'test.com' } } } });

    // Only delete academic year if we created a temporary one (though tests usually shouldn't delete global seed data)
    // Actually, since we might have just reused the global one, let's NOT delete the academic year to be safe, 
    // or just let it be. But wait, if we created it, we should delete it. 
    // Actually, deleting section is enough.
    // Skip deleting section to avoid assignment FK violations
    await prisma.subject.deleteMany({ where: { id: subjectId } });

    await prisma.userRole.deleteMany({
      where: { user: { email: { contains: 'test.com' } } }
    });
    await prisma.user.deleteMany({
      where: { email: { contains: 'test.com' } }
    });
  });

  describe('1. Student Creation Ownership (POST /api/attendance/excuses)', () => {
    it('should allow student to create for themselves', async () => {
      const res = await request(app)
        .post('/api/attendance/excuses')
        .set('Authorization', `Bearer ${studentAToken}`)
        .send({
          teacherId: teacherAId,
          startDate: '2026-10-10',
          endDate: '2026-10-11',
          reason: 'Sick leave'
        });
      
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.student_id).toBe(studentAId);
      expect(res.body.data.teacher_id).toBe(teacherAId);
      expect(res.body.data.status).toBe('Pending Review');
      createdExcuseLetterId = res.body.data.id;
    });

    it('should reject creation if teacher does not teach student', async () => {
      // Teacher B is not assigned to Student A's section
      const res = await request(app)
        .post('/api/attendance/excuses')
        .set('Authorization', `Bearer ${studentAToken}`)
        .send({
          teacherId: teacherBId,
          startDate: '2026-10-10',
          endDate: '2026-10-11',
          reason: 'Sick leave'
        });
      
      expect(res.status).toBe(403);
    });

    it('should reject creation if endDate < startDate', async () => {
      const res = await request(app)
        .post('/api/attendance/excuses')
        .set('Authorization', `Bearer ${studentAToken}`)
        .send({
          teacherId: teacherAId,
          startDate: '2026-10-11',
          endDate: '2026-10-10',
          reason: 'Time travel'
        });
      
      expect(res.status).toBe(400);
    });

    it('should NOT allow arbitrary cross-student creation', async () => {
      // The API infers the student from the token. We can't actually inject student_id into the body.
      // We will verify the schema ignores any student_id we send.
      const res = await request(app)
        .post('/api/attendance/excuses')
        .set('Authorization', `Bearer ${studentAToken}`)
        .send({
          student_id: studentBId,
          studentId: studentBId,
          teacherId: teacherAId,
          startDate: '2026-10-10',
          endDate: '2026-10-11',
          reason: 'Hacking attempt'
        });
      
      expect(res.status).toBe(201);
      expect(res.body.data.student_id).toBe(studentAId); // Identity derived from token, not input
      expect(res.body.data.student_id).not.toBe(studentBId);
    });
  });

  describe('2. Student Read Behavior (GET /api/attendance/excuses/:studentId)', () => {
    it('should allow Student A to read Student A records', async () => {
      const res = await request(app)
        .get(`/api/attendance/excuses/${studentAId}`)
        .set('Authorization', `Bearer ${studentAToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].student_id).toBe(studentAId);
    });

    it('should reject Student A reading Student B records', async () => {
      const res = await request(app)
        .get(`/api/attendance/excuses/${studentBId}`)
        .set('Authorization', `Bearer ${studentAToken}`);
      
      expect(res.status).toBe(403);
    });
  });

  describe('3. Teacher Listing (GET /api/attendance/excuses/teacher/me)', () => {
    it('should return excuse letters assigned to Teacher A', async () => {
      const res = await request(app)
        .get('/api/attendance/excuses/teacher/me')
        .set('Authorization', `Bearer ${teacherAToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].teacher_id).toBe(teacherAId);
      // Student details should be included
      expect(res.body.data[0].student).toBeDefined();
    });

    it('should NOT return Teacher A records to Teacher B', async () => {
      const res = await request(app)
        .get('/api/attendance/excuses/teacher/me')
        .set('Authorization', `Bearer ${teacherBToken}`);
      
      expect(res.status).toBe(200);
      // Teacher B has 1 seeded record for Student B
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].student_id).toBe(studentBId);
    });
  });

  describe('4. Status Updates (PATCH /api/attendance/excuses/:id/status)', () => {
    it('should reject Teacher B updating Teacher A excuse', async () => {
      const res = await request(app)
        .patch(`/api/attendance/excuses/${createdExcuseLetterId}/status`)
        .set('Authorization', `Bearer ${teacherBToken}`)
        .send({ status: 'Approved' });
      
      expect(res.status).toBe(403);
      
      // DB remains unchanged
      const dbCheck = await prisma.excuseLetter.findUnique({ where: { id: createdExcuseLetterId } });
      expect(dbCheck?.status).toBe('Pending Review');
    });

    it('should allow Teacher A to update Teacher A excuse', async () => {
      const res = await request(app)
        .patch(`/api/attendance/excuses/${createdExcuseLetterId}/status`)
        .set('Authorization', `Bearer ${teacherAToken}`)
        .send({ status: 'Approved', teacherNote: 'Get well soon' });
      
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('Approved');
      expect(res.body.data.teacher_note).toBe('Get well soon');
      
      // DB state authoritative
      const dbCheck = await prisma.excuseLetter.findUnique({ where: { id: createdExcuseLetterId } });
      expect(dbCheck?.status).toBe('Approved');
    });

    it('should reject invalid status', async () => {
      const res = await request(app)
        .patch(`/api/attendance/excuses/${createdExcuseLetterId}/status`)
        .set('Authorization', `Bearer ${teacherAToken}`)
        .send({ status: 'Super Approved' });
      
      expect(res.status).toBe(422); // Zod validation error
    });

    it('should return 404 for unknown ID', async () => {
      const res = await request(app)
        .patch(`/api/attendance/excuses/nonexistent-id/status`)
        .set('Authorization', `Bearer ${teacherAToken}`)
        .send({ status: 'Approved' });
      
      expect(res.status).toBe(404);
    });
  });
});
