import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/database.js';
import { generateId } from '../src/common/utils/uuid.js';
import { sign } from 'jsonwebtoken';
import { config } from '../src/config/env.js';

describe('Phase 4L: Document Requests Characterization Tests', () => {
  let studentAToken: string;
  let studentBToken: string;
  let teacherAToken: string;
  let teacherBToken: string;
  let principalToken: string;
  let adminToken: string;
  
  let studentAId: string;
  let studentAUserId: string;
  let studentBId: string;
  let teacherAId: string;
  let teacherBId: string;
  let principalId: string;

  let requestFromStudentServices: string;
  let requestFromDocuments: string;

  beforeAll(async () => {
    // Helper to create users and tokens
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
        
        for (const perm of permissions) {
          let p = await prisma.permission.findFirst({ where: { key: perm } });
          if (!p) p = await prisma.permission.create({ data: { id: generateId(), key: perm } });
          await prisma.rolePermission.createMany({
            data: [{ role_id: role.id, permission_id: p.id }],
            skipDuplicates: true
          });
        }
      }

      const token = sign(
        { userId: user.id, email: user.email, roles },
        config.jwt.secret,
        { expiresIn: '1h' }
      );
      return { user, token };
    };

    // Create Actors
    const ts = Date.now();
    const studentA = await createUser(`studentA-${ts}@test.com`, ['Student'], ['document:request']);
    const studentB = await createUser(`studentB-${ts}@test.com`, ['Student'], ['document:request']);
    const teacherA = await createUser(`teacherA-${ts}@test.com`, ['Teacher'], ['document:approve']);
    const teacherB = await createUser(`teacherB-${ts}@test.com`, ['Teacher'], ['document:approve']);
    const principal = await createUser(`principal-${ts}@test.com`, ['Principal'], ['document:approve']);
    const admin = await createUser(`admin-${ts}@test.com`, ['Admin'], ['document:approve']);

    studentAToken = studentA.token;
    studentBToken = studentB.token;
    teacherAToken = teacherA.token;
    teacherBToken = teacherB.token;
    principalToken = principal.token;
    adminToken = admin.token;

    // Create related profile records required by DB constraints
    const sA = await prisma.student.create({ data: { id: generateId(), user_id: studentA.user.id, lrn: `LRN-${ts}-A`, grade_level: 10 } });
    studentAId = sA.id;
    studentAUserId = studentA.user.id;
    const sB = await prisma.student.create({ data: { id: generateId(), user_id: studentB.user.id, lrn: `LRN-${ts}-B`, grade_level: 10 } });
    studentBId = sB.id;
    
    const tA = await prisma.teacher.create({ data: { id: generateId(), user_id: teacherA.user.id, specialization: 'Math', employee_id: `EMP-${ts}-A` } });
    teacherAId = tA.id;
    const tB = await prisma.teacher.create({ data: { id: generateId(), user_id: teacherB.user.id, specialization: 'Science', employee_id: `EMP-${ts}-B` } });
    teacherBId = tB.id;

    principalId = principal.user.id;
  });

  afterAll(async () => {
    // Cleanup deterministic test data
    const sIds = [studentAId, studentBId].filter(Boolean);
    const tIds = [teacherAId, teacherBId].filter(Boolean);

    await prisma.documentRequest.deleteMany({
      where: {
        OR: [
          { student_id: { in: sIds } }
        ]
      }
    });
    const testUsers = await prisma.user.findMany({ where: { email: { contains: '@test.com' } }, select: { id: true } });
    const testUserIds = testUsers.map((u: any) => u.id);
    await prisma.auditLog.deleteMany({
      where: {
        actor_user_id: { in: testUserIds }
      }
    });

    if (sIds.length > 0) await prisma.student.deleteMany({ where: { id: { in: sIds } } });
    if (tIds.length > 0) await prisma.teacher.deleteMany({ where: { id: { in: tIds } } });
    await prisma.userRole.deleteMany({ where: { user: { email: { contains: '@test.com' } } } });
    await prisma.user.deleteMany({ where: { email: { contains: '@test.com' } } });
  });

  it('1. POST /api/student-services/doc-requests - Student creation ownership enforced', async () => {
    // Student A creates for Student A -> succeeds
    const resA = await request(app)
      .post('/api/student-services/doc-requests')
      .set('Authorization', `Bearer ${studentAToken}`)
      .send({
        studentId: studentAId,
        studentName: 'Student A',
        section: 'Section A',
        documentType: 'Transcript',
        purpose: 'Transfer',
        teacherId: teacherAId
      });
    expect(resA.status).toBe(201);
    expect(resA.body.data.student_id).toBe(studentAId);
    requestFromStudentServices = resA.body.data.id;

    // Student A attempts for Student B -> rejected
    const resB = await request(app)
      .post('/api/student-services/doc-requests')
      .set('Authorization', `Bearer ${studentAToken}`)
      .send({
        studentId: studentBId,
        studentName: 'Student B',
        section: 'Section B',
        documentType: 'Transcript',
        purpose: 'Transfer'
      });
    expect(resB.status).toBe(403);
    
    // Inappropriate non-student caller (Teacher) -> rejected
    const resTeacher = await request(app)
      .post('/api/student-services/doc-requests')
      .set('Authorization', `Bearer ${teacherAToken}`)
      .send({
        studentId: studentAId,
        studentName: 'Student A',
        section: 'Section A',
        documentType: 'Transcript',
        purpose: 'Transfer'
      });
    expect(resTeacher.status).toBe(403);
  });

  it('2. POST /api/documents/requests - Creation identity resolved correctly', async () => {
    // Valid identity -> succeeds
    const resValid = await request(app)
      .post('/api/documents/requests')
      .set('Authorization', `Bearer ${studentAToken}`)
      .send({
        studentId: studentAUserId, // Uses User.id as expected by the contract
        documentType: 'Good Moral',
        purpose: 'College App'
      });
    expect(resValid.status).toBe(201);
    expect(resValid.body.data.student_id).toBe(studentAId); // Verifies correct Student.id stored
    requestFromDocuments = resValid.body.data.id;
      
    // Nonexistent identity -> 404
    const resInvalid = await request(app)
      .post('/api/documents/requests')
      .set('Authorization', `Bearer ${studentAToken}`)
      .send({
        studentId: 'non-existent-user-id',
        documentType: 'Good Moral',
        purpose: 'College App'
      });
    expect(resInvalid.status).toBe(404);
  });

  it('3. GET /api/student-services/doc-requests/:studentId - Read boundaries enforced', async () => {
    // Student A reads own -> succeeds
    const resA = await request(app)
      .get(`/api/student-services/doc-requests/${studentAId}`)
      .set('Authorization', `Bearer ${studentAToken}`);
    expect(resA.status).toBe(200);
    expect(resA.body.data.length).toBeGreaterThan(0);
      
    // Student A reads Student B -> rejected
    const resB = await request(app)
      .get(`/api/student-services/doc-requests/${studentBId}`)
      .set('Authorization', `Bearer ${studentAToken}`);
    expect(resB.status).toBe(403);

    // Teacher reads Student A -> succeeds but only sees assigned requests
    const resTeacherA = await request(app)
      .get(`/api/student-services/doc-requests/${studentAId}`)
      .set('Authorization', `Bearer ${teacherAToken}`);
    expect(resTeacherA.status).toBe(200);
    // requestFromStudentServices was assigned to teacherAId
    expect(resTeacherA.body.data.every((r: any) => r.teacher_id === teacherAId)).toBe(true);
  });

  it('4. GET /api/student-services/doc-requests - Role-scoped listing', async () => {
    const res = await request(app)
      .get(`/api/student-services/doc-requests`)
      .set('Authorization', `Bearer ${studentAToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.every((r: any) => r.studentId === studentAId)).toBe(true);
  });

  it('5. PATCH /api/documents/requests/:id - Teacher ownership enforced', async () => {
    // Teacher B attempts to approve Teacher A's request -> rejected
    const resB = await request(app)
      .patch(`/api/documents/requests/${requestFromStudentServices}`)
      .set('Authorization', `Bearer ${teacherBToken}`)
      .send({
        status: 'Teacher Approved',
        currentStage: 2,
        teacherApprovedDate: new Date().toISOString(),
        teacherRemarks: 'Teacher B approval'
      });
    expect(resB.status).toBe(403);

    // DB remains unchanged
    const dbCheck = await prisma.documentRequest.findUnique({ where: { id: requestFromStudentServices } });
    expect(dbCheck?.status).toBe('Submitted');

    // Teacher A approves their own request -> succeeds
    const resA = await request(app)
      .patch(`/api/documents/requests/${requestFromStudentServices}`)
      .set('Authorization', `Bearer ${teacherAToken}`)
      .send({
        status: 'Teacher Approved',
        currentStage: 2,
        teacherApprovedDate: new Date().toISOString(),
        teacherRemarks: 'Looks good'
      });
    expect(resA.status).toBe(200);
    expect(resA.body.data.status).toBe('Teacher Approved');
    expect(resA.body.data.current_stage).toBe(2);
  });

  it('6. PATCH /api/documents/requests/:id - Principal Approved', async () => {
    const res = await request(app)
      .patch(`/api/documents/requests/${requestFromStudentServices}`)
      .set('Authorization', `Bearer ${principalToken}`)
      .send({
        status: 'Principal Approved',
        currentStage: 3,
        principalApprovedDate: new Date().toISOString()
      });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('Principal Approved');
  });

  it('7. PATCH /api/documents/requests/:id - Ready for Pickup', async () => {
    const res = await request(app)
      .patch(`/api/documents/requests/${requestFromStudentServices}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'Ready for Pickup',
        currentStage: 4,
        readyDate: new Date().toISOString()
      });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('Ready for Pickup');
  });
});
