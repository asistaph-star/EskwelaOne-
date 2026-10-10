import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { PrismaClient } from '@prisma/client';
import { generateId } from '../src/common/utils/uuid';
import { sign } from 'jsonwebtoken';
import { config } from '../src/config/env';

const prisma = new PrismaClient();

describe('Phase 5D: Principal Schedule API Regression Tests', () => {
  let principalToken: string;
  let teacherToken: string;
  
  let principalUserId: string;
  let teacherUserId: string;
  let testTeacherId: string;

  let testYearId: string;
  let testSectionId: string;
  let testSubjectId: string;

  beforeAll(async () => {
    // 1. Setup Roles & Permissions
    const pRole = await prisma.role.findFirst({ where: { name: 'Principal' } }) || 
                  await prisma.role.create({ data: { id: generateId(), name: 'Principal' } });
    const tRole = await prisma.role.findFirst({ where: { name: 'Teacher' } }) || 
                  await prisma.role.create({ data: { id: generateId(), name: 'Teacher' } });
    
    const assignWrite = await prisma.permission.upsert({
      where: { key: 'assignment:write' },
      update: {},
      create: { id: generateId(), key: 'assignment:write' }
    });

    await prisma.rolePermission.upsert({
      where: { role_id_permission_id: { role_id: pRole.id, permission_id: assignWrite.id } },
      update: {},
      create: { role_id: pRole.id, permission_id: assignWrite.id }
    });

    // 2. Setup Users
    principalUserId = generateId();
    await prisma.user.create({
      data: {
        id: principalUserId, email: `p_sched_${Date.now()}@calulut.edu.ph`, password_hash: 'hash', first_name: 'P', last_name: 'Sched', status: 'active', must_change_password: false,
        user_roles: { create: { role_id: pRole.id } }
      }
    });
    principalToken = sign({ userId: principalUserId }, config.jwt.secret, { expiresIn: '1h' });

    teacherUserId = generateId();
    await prisma.user.create({
      data: {
        id: teacherUserId, email: `t_sched_${Date.now()}@calulut.edu.ph`, password_hash: 'hash', first_name: 'T', last_name: 'Sched', status: 'active', must_change_password: false,
        user_roles: { create: { role_id: tRole.id } }
      }
    });
    teacherToken = sign({ userId: teacherUserId }, config.jwt.secret, { expiresIn: '1h' });

    testTeacherId = generateId();
    await prisma.teacher.create({
      data: {
        id: testTeacherId,
        user_id: teacherUserId,
        employee_id: `EMP-${Date.now()}`
      }
    });

    // 3. Setup Academic Year, Section, Subject
    testYearId = generateId();
    await prisma.academicYear.create({
      data: { id: testYearId, name: `Year ${Date.now()}`, is_current: false, start_date: new Date(), end_date: new Date(Date.now() + 86400000 * 365) }
    });

    testSectionId = generateId();
    await prisma.section.create({
      data: { id: testSectionId, academic_year_id: testYearId, name: 'Section Sched', grade_level: 7 }
    });

    testSubjectId = generateId();
    await prisma.subject.create({
      data: { id: testSubjectId, code: `SUB-${Date.now()}`, name: 'Subject Sched' }
    });
  });

  afterAll(async () => {
    // Cleanup safely
    try {
      const assignments = await prisma.teacherSubjectAssignment.findMany({ where: { teacher_id: testTeacherId } });
      const assignmentIds = assignments.map(a => a.id);
      
      if (assignmentIds.length > 0) {
        await prisma.classAttendance.deleteMany({ where: { assignment_id: { in: assignmentIds } } });
        await prisma.teacherSubjectAssignment.deleteMany({ where: { teacher_id: testTeacherId } });
      }
      
      await prisma.teacher.delete({ where: { id: testTeacherId } });
      await prisma.section.delete({ where: { id: testSectionId } });
      await prisma.subject.delete({ where: { id: testSubjectId } });
      await prisma.academicYear.delete({ where: { id: testYearId } });

      await prisma.userRole.deleteMany({ where: { user_id: { in: [principalUserId, teacherUserId] } } });
      await prisma.auditLog.deleteMany({ where: { actor_user_id: { in: [principalUserId, teacherUserId] } } });
      await prisma.user.deleteMany({ where: { id: { in: [principalUserId, teacherUserId] } } });
    } catch (e) {
      console.warn("Teardown error", e);
    }
    await prisma.$disconnect();
  });

  it('unauthenticated -> 401', async () => {
    const res = await request(app).post('/api/academic/assignments').send({});
    expect(res.status).toBe(401);
  });

  it('unauthorized role -> 403', async () => {
    const res = await request(app)
      .post('/api/academic/assignments')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        academicYearId: testYearId,
        teacherId: testTeacherId,
        sectionId: testSectionId,
        subjectId: testSubjectId
      });
    expect(res.status).toBe(403);
  });

  it('malformed start_time -> rejected', async () => {
    const res = await request(app)
      .post('/api/academic/assignments')
      .set('Authorization', `Bearer ${principalToken}`)
      .send({
        academicYearId: testYearId,
        teacherId: testTeacherId,
        sectionId: testSectionId,
        subjectId: testSubjectId,
        startTime: '8:00 AM' // Must be HH:MM
      });
    expect(res.status).toBe(422);
  });

  it('malformed end_time -> rejected', async () => {
    const res = await request(app)
      .post('/api/academic/assignments')
      .set('Authorization', `Bearer ${principalToken}`)
      .send({
        academicYearId: testYearId,
        teacherId: testTeacherId,
        sectionId: testSectionId,
        subjectId: testSubjectId,
        endTime: '12-30'
      });
    expect(res.status).toBe(422);
  });

  it('start_time >= end_time -> rejected', async () => {
    const res = await request(app)
      .post('/api/academic/assignments')
      .set('Authorization', `Bearer ${principalToken}`)
      .send({
        academicYearId: testYearId,
        teacherId: testTeacherId,
        sectionId: testSectionId,
        subjectId: testSubjectId,
        startTime: '10:00',
        endTime: '09:00'
      });
    expect(res.status).toBe(422);
  });

  it('invalid foreign keys -> handled correctly', async () => {
    const res = await request(app)
      .post('/api/academic/assignments')
      .set('Authorization', `Bearer ${principalToken}`)
      .send({
        academicYearId: testYearId,
        teacherId: 'invalid-teacher-id',
        sectionId: testSectionId,
        subjectId: testSubjectId
      });
    // Should trigger Prisma foreign key error caught by error handler (usually 400 or 500 mapped in generic error)
    // We expect it to fail, not succeed.
    expect(res.status).not.toBe(201);
  });

  it('valid schedule -> persisted to PostgreSQL and read back correctly', async () => {
    const res = await request(app)
      .post('/api/academic/assignments')
      .set('Authorization', `Bearer ${principalToken}`)
      .send({
        academicYearId: testYearId,
        teacherId: testTeacherId,
        sectionId: testSectionId,
        subjectId: testSubjectId,
        days: 'M,W,F',
        startTime: '08:00',
        endTime: '09:30',
        room: 'Room 101'
      });
    
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    // Verify DB Row
    const dbRow = await prisma.teacherSubjectAssignment.findUnique({
      where: { id: res.body.data.id }
    });

    expect(dbRow).not.toBeNull();
    expect(dbRow?.days).toBe('M,W,F');
    expect(dbRow?.start_time).toBe('08:00');
    expect(dbRow?.end_time).toBe('09:30');
    expect(dbRow?.room).toBe('Room 101');
  });

  it('duplicate insertion -> rejected', async () => {
    // Exact same combination as the previous valid test
    const res = await request(app)
      .post('/api/academic/assignments')
      .set('Authorization', `Bearer ${principalToken}`)
      .send({
        academicYearId: testYearId,
        teacherId: testTeacherId,
        sectionId: testSectionId,
        subjectId: testSubjectId
      });
    
    expect(res.status).toBe(400);
  });
});
