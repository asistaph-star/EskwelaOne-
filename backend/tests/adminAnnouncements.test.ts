import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { PrismaClient } from '@prisma/client';
import { generateId } from '../src/common/utils/uuid';
import { sign } from 'jsonwebtoken';
import { config } from '../src/config/env';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

describe('Phase 5D: Admin Announcements Authorization', () => {
  let principalToken: string;
  let teacherToken: string;
  let studentToken: string;

  let teacherUserId: string;
  let studentUserId: string;
  let principalUserId: string;

  beforeAll(async () => {
    const password_hash = await bcrypt.hash('password123', 10);
    
    // Ensure roles exist
    let pRole = await prisma.role.findFirst({ where: { name: 'Principal' } });
    if (!pRole) pRole = await prisma.role.create({ data: { id: generateId(), name: 'Principal' } });
    
    let tRole = await prisma.role.findFirst({ where: { name: 'Teacher' } });
    if (!tRole) tRole = await prisma.role.create({ data: { id: generateId(), name: 'Teacher' } });

    let sRole = await prisma.role.findFirst({ where: { name: 'Student' } });
    if (!sRole) sRole = await prisma.role.create({ data: { id: generateId(), name: 'Student' } });

    // Give Principal the announcement:write permission
    const annPerm = await prisma.permission.upsert({
      where: { key: 'announcement:write' },
      update: {},
      create: { id: generateId(), key: 'announcement:write' }
    });
    await prisma.rolePermission.upsert({
      where: { role_id_permission_id: { role_id: pRole.id, permission_id: annPerm.id } },
      update: {},
      create: { role_id: pRole.id, permission_id: annPerm.id }
    });

    // Create Principal
    principalUserId = generateId();
    await prisma.user.create({
      data: {
        id: principalUserId, email: 'p_test@calulut.edu.ph', password_hash, first_name: 'P', last_name: 'Test', status: 'active', must_change_password: false,
        user_roles: { create: { role_id: pRole.id } }
      }
    });
    principalToken = sign({ userId: principalUserId }, config.jwt.secret, { expiresIn: '1h' });

    // Create Teacher
    teacherUserId = generateId();
    await prisma.user.create({
      data: {
        id: teacherUserId, email: 't_test@calulut.edu.ph', password_hash, first_name: 'T', last_name: 'Test', status: 'active', must_change_password: false,
        user_roles: { create: { role_id: tRole.id } }
      }
    });
    teacherToken = sign({ userId: teacherUserId }, config.jwt.secret, { expiresIn: '1h' });

    // Create Student
    studentUserId = generateId();
    await prisma.user.create({
      data: {
        id: studentUserId, email: 's_test@calulut.edu.ph', password_hash, first_name: 'S', last_name: 'Test', status: 'active', must_change_password: false,
        user_roles: { create: { role_id: sRole.id } }
      }
    });
    studentToken = sign({ userId: studentUserId }, config.jwt.secret, { expiresIn: '1h' });
  });

  afterAll(async () => {
    const userIds = [principalUserId, teacherUserId, studentUserId].filter(Boolean) as string[];
    if (userIds.length > 0) {
      await prisma.userRole.deleteMany({ where: { user_id: { in: userIds } } });
      await prisma.auditLog.deleteMany({ where: { actor_user_id: { in: userIds } } });
      await prisma.announcement.deleteMany({ where: { author_id: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await prisma.$disconnect();
  });

  it('Principal (with announcement:write) can POST an announcement', async () => {
    const res = await request(app)
      .post('/api/admin/announcements')
      .set('Authorization', `Bearer ${principalToken}`)
      .send({
        title: 'Test Principal Announcement',
        body: 'This is a test announcement from Principal',
        audience: 'All'
      });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('Student cannot POST an announcement', async () => {
    const res = await request(app)
      .post('/api/admin/announcements')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        title: 'Student Hack',
        body: 'Hacked the system',
        audience: 'All'
      });
    expect(res.status).toBe(403);
  });

  it('Teacher cannot POST an announcement (unless they have announcement:write)', async () => {
    const res = await request(app)
      .post('/api/admin/announcements')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        title: 'Teacher Announce',
        body: 'Just testing',
        audience: 'Teachers'
      });
    expect(res.status).toBe(403);
  });

  it('Unauthenticated user receives 401', async () => {
    const res = await request(app)
      .post('/api/admin/announcements')
      .send({
        title: 'No token',
        body: 'Should fail',
        audience: 'All'
      });
    expect(res.status).toBe(401);
  });
});
