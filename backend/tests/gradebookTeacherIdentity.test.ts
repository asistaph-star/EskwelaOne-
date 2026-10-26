import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import prisma from '../src/config/database.js';
import { config } from '../src/config/env.js';
import { getLedger, saveLedger } from '../src/gradebooks/ledger.service.js';

describe('DIGISKWELA — SEC-AUTHZ-001 Gradebook Teacher Identity & Ownership Verification', () => {
  // Synthetic Teacher 1 (Legitimate Owner where Teacher.id !== User.id)
  const teacher1UserId = 'synth-u-teach-authz-1';
  const teacher1ProfileId = 'synth-p-teach-authz-1'; // Strictly different from user_id!
  const teacher1SchoolId = 'SYNTH-TCH-001';

  // Synthetic Teacher 2 (Unauthorized Teacher where Teacher.id !== User.id)
  const teacher2UserId = 'synth-u-teach-authz-2';
  const teacher2ProfileId = 'synth-p-teach-authz-2';
  const teacher2SchoolId = 'SYNTH-TCH-002';

  const assignmentId = 'synth-assign-authz-test';
  const sectionId = 'synth-sec-authz-test';

  let teacher1Token: string;
  let teacher2Token: string;

  async function cleanup() {
    await prisma.grade_entries.deleteMany({
      where: { column: { gradebook: { assignment_id: assignmentId } } }
    });
    await prisma.gradebook_columns.deleteMany({
      where: { gradebook: { assignment_id: assignmentId } }
    });
    await prisma.gradebooks.deleteMany({ where: { assignment_id: assignmentId } });
    await prisma.teacherSubjectAssignment.deleteMany({ where: { id: assignmentId } });
    await prisma.section.deleteMany({ where: { id: sectionId } });

    // Clean up synthetic teacher profiles
    await prisma.teacher.deleteMany({
      where: { id: { in: [teacher1ProfileId, teacher2ProfileId] } }
    });

    // Clean up synthetic user roles and users
    await prisma.userRole.deleteMany({
      where: { user_id: { in: [teacher1UserId, teacher2UserId] } }
    });
    await prisma.user.deleteMany({
      where: { id: { in: [teacher1UserId, teacher2UserId] } }
    });
  }

  beforeAll(async () => {
    await cleanup();

    const roleTeacher = await prisma.role.findUnique({ where: { name: 'Teacher' } });
    if (!roleTeacher) throw new Error('Teacher role not found');

    // 1. Create Teacher 1 (Owner)
    await prisma.user.create({
      data: {
        id: teacher1UserId,
        school_id: teacher1SchoolId,
        email: 'teach1_authz@test.local',
        password_hash: 'HASH_NOT_USED_IN_TEST',
        first_name: 'AuthzOwner',
        last_name: 'Teacher',
        status: 'active',
        user_roles: { create: { role_id: roleTeacher.id } }
      }
    });

    await prisma.teacher.create({
      data: {
        id: teacher1ProfileId,
        user_id: teacher1UserId,
        employee_id: teacher1SchoolId,
        department: 'Science',
        position: 'Teacher I'
      }
    });

    // 2. Create Teacher 2 (Attacker / Unauthorized Caller)
    await prisma.user.create({
      data: {
        id: teacher2UserId,
        school_id: teacher2SchoolId,
        email: 'teach2_authz@test.local',
        password_hash: 'HASH_NOT_USED_IN_TEST',
        first_name: 'Unauthorized',
        last_name: 'Teacher',
        status: 'active',
        user_roles: { create: { role_id: roleTeacher.id } }
      }
    });

    await prisma.teacher.create({
      data: {
        id: teacher2ProfileId,
        user_id: teacher2UserId,
        employee_id: teacher2SchoolId,
        department: 'Math',
        position: 'Teacher II'
      }
    });

    // 3. Create Section and Assignment linked to Teacher 1's profile ID
    await prisma.section.create({
      data: {
        id: sectionId,
        name: 'Authz-Test-Section',
        grade_level: 10,
        academic_year_id: 'demo-ay-2026'
      }
    });

    await prisma.teacherSubjectAssignment.create({
      data: {
        id: assignmentId,
        academic_year_id: 'demo-ay-2026',
        teacher_id: teacher1ProfileId, // Points to Teacher profile, NOT User ID!
        section_id: sectionId,
        subject_id: 'demo-subj-math10'
      }
    });

    teacher1Token = jwt.sign({ userId: teacher1UserId }, config.jwt.secret, { expiresIn: '1h' });
    teacher2Token = jwt.sign({ userId: teacher2UserId }, config.jwt.secret, { expiresIn: '1h' });
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it('TC-AUTHZ-01: Proves assigned teacher where Teacher.id != User.id can successfully access own ledger via getLedger', async () => {
    // Verified precondition: Teacher.id is strictly different from User.id
    expect(teacher1ProfileId).not.toBe(teacher1UserId);

    // Call service directly
    const ledgerData = await getLedger(assignmentId, teacher1UserId);
    expect(ledgerData).toBeDefined();
    expect(ledgerData.terms).toBeDefined();
    expect(ledgerData.roster).toBeDefined();

    // Call via HTTP endpoint
    const res = await request(app)
      .get(`/api/gradebooks/ledger?classId=${assignmentId}`)
      .set('Authorization', `Bearer ${teacher1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.terms).toBeDefined();
  });

  it('TC-AUTHZ-02: Proves unauthorized teacher receives 403 FORBIDDEN when attempting to read another teacher\'s ledger', async () => {
    // Calling with Teacher 2's User ID must reject with 403
    await expect(getLedger(assignmentId, teacher2UserId)).rejects.toThrow();

    const res = await request(app)
      .get(`/api/gradebooks/ledger?classId=${assignmentId}`)
      .set('Authorization', `Bearer ${teacher2Token}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('TC-AUTHZ-03: Proves unauthorized teacher receives 403 FORBIDDEN when attempting to mutate another teacher\'s ledger via saveLedger', async () => {
    const payload = {
      T1: { wwItems: [], ptItems: [], qaMax: 100, grades: {} }
    };

    // Calling saveLedger with Teacher 2's User ID must reject with 403
    await expect(saveLedger(assignmentId, payload, teacher2UserId)).rejects.toThrow();

    const res = await request(app)
      .post('/api/gradebooks/ledger')
      .set('Authorization', `Bearer ${teacher2Token}`)
      .send({
        classId: assignmentId,
        terms: payload
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });
});
